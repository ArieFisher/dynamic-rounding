// Checks that read source files, the manifest, bundles, or the living docs as text.

// --- Sprint icon-no-sidebar: manifest + background invariants ---
// NOTE: These are static-analysis proxies only. Whether the toolbar icon
// actually disappears in Chrome, and whether the context menu visually works,
// cannot be verified in this Node harness — those require a live browser.

(function sprintIconNoSidebar() {
  const manifestPath = path.join(__dirname, 'manifest.json');
  const bgPath = path.join(__dirname, 'background.js');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const bgSource = fs.readFileSync(bgPath, 'utf8');

  // 1. "action" key must be absent — its presence would register a toolbar icon.
  eq('manifest: no "action" key (toolbar icon suppressed)',
    Object.prototype.hasOwnProperty.call(manifest, 'action'), false);

  // 2. "side_panel" must still be present — the panel itself must remain registered.
  eq('manifest: "side_panel" key still present',
    Object.prototype.hasOwnProperty.call(manifest, 'side_panel'), true);

  // 3. "contextMenus" must still be in permissions — right-click menu requires it.
  eq('manifest: "contextMenus" still in permissions',
    Array.isArray(manifest.permissions) && manifest.permissions.includes('contextMenus'), true);

  // 4. background.js must NOT reference chrome.action — no remnant action API usage.
  eq('background.js: no chrome.action.* references',
    /chrome\.action\b/.test(bgSource), false);

  // 5. background.js must still wire up contextMenus.create and sidePanel.open.
  eq('background.js: contextMenus.create still present',
    bgSource.includes('contextMenus.create'), true);

  eq('background.js: sidePanel.open still present',
    bgSource.includes('sidePanel.open'), true);
})();

// --- AC5: manifest.json has a valid N.N.N version string ---
(function ac5_manifestVersion() {
  const manifest = JSON.parse(
    require('fs').readFileSync(require('path').join(__dirname, 'manifest.json'), 'utf8'));
  eq('AC5: manifest.json version matches semver N.N.N',
    /^\d+\.\d+\.\d+$/.test(manifest.version), true);
})();

// --- AC6: scope guard removed — was a git-diff-based assertion that
// presumed a single-commit sprint and breaks in a stacked-PR world.
// The content-based regression guards in the quote and decimal blocks
// (which assert no sibling files contain new identifiers) cover the same
// intent without depending on git history shape.

// --- Static analysis: link-aware functions are defined and exported ---
(function ac_staticAnalysis() {
  eq('static: isCellWholeLink is defined', typeof isCellWholeLink, 'function');
  eq('static: filterLinkMatches is defined', typeof filterLinkMatches, 'function');

  // isCellWholeLink: cell with no querySelectorAll support returns false safely
  eq('static: isCellWholeLink handles cell without querySelectorAll',
    isCellWholeLink({ innerText: '123' }), false);

  // filterLinkMatches: returns original matches when cell has no querySelectorAll
  const dummyMatches = [{ numStr: '100', num: 100, index: 0 }];
  eq('static: filterLinkMatches returns matches unchanged when cell has no querySelectorAll',
    filterLinkMatches({ innerText: '100' }, dummyMatches), dummyMatches);

  // filterLinkMatches: empty matches returned as-is
  eq('static: filterLinkMatches handles empty matches array',
    filterLinkMatches({ innerText: '100', querySelectorAll: () => [] }, []).length, 0);
})();

// --- Sprint decimal-precision-display: regression guards ---

(function sprintRegressionGuards() {
  const manifestPath = path.join(__dirname, 'manifest.json');
  const readmePath = path.join(__dirname, '..', 'js', 'README.md');
  const changelogPath = path.join(__dirname, '..', 'js', 'CHANGELOG.md');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  eq('sprint regression: manifest version matches N.N.N',
    /^\d+\.\d+\.\d+$/.test(manifest.version), true);

  const readme = fs.readFileSync(readmePath, 'utf8');
  eq('sprint regression: js/README.md contains Sheets decimal precision section header',
    /##\s+Note:\s+decimal precision in Sheets/i.test(readme), true);

  const changelog = fs.readFileSync(changelogPath, 'utf8');
  eq('sprint regression: js/CHANGELOG.md contains doc update entry',
    /decimal precision in Sheets/.test(changelog), true);

  // Python directory: verify no .py files were modified (static guard via git-ignored stat)
  // We cannot run git here, so we verify python/ files are still intact by checking
  // that the python directory exists and contains expected files.
  const pythonDir = path.join(__dirname, '..', 'python');
  const fsStat = require('fs');
  eq('sprint regression: python/ directory exists (not deleted)',
    fsStat.existsSync(pythonDir), true);
})();

// --- Sprint sidebar-defaults-and-layout ---

(function sprintSidebarDefaultsAndLayout() {
  const sidebarPath = path.join(__dirname, 'sidebar.html');
  const sidebarHtml = fs.readFileSync(sidebarPath, 'utf8');

  const manifestPath = path.join(__dirname, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const sidebarJsPath = path.join(__dirname, 'sidebar.js');
  const sidebarJsSource = fs.readFileSync(sidebarJsPath, 'utf8');

  const contentJsSource = sourceByName('content.js');
  if (contentJsSource === null) {
    eq('sidebar-defaults: source file content.js present in manifest', false, true);
    return;
  }

  // AC1/AC2: Sidebar UI defaults now live in constants.js (single source of
  // truth shared with content.js). The HTML must NOT hard-code checked /
  // selected attributes — they would shadow the JS-applied defaults.
  eq('sidebar-defaults: simplifyMixedCells default is true in DR_DEFAULTS',
    DR_DEFAULTS.simplifyMixedCells, true);
  eq('sidebar-defaults: simplifyMixedCurrency default is true in DR_DEFAULTS',
    DR_DEFAULTS.simplifyMixedCurrency, true);
  eq('sidebar-defaults: simplifyMixedPercent default is true in DR_DEFAULTS',
    DR_DEFAULTS.simplifyMixedPercent, true);
  eq('sidebar-defaults: dateGranularity default is "year" in DR_DEFAULTS',
    DR_DEFAULTS.dateGranularity, 'year');
  eq('sidebar-defaults: timeGranularity default is "hour" in DR_DEFAULTS',
    DR_DEFAULTS.timeGranularity, 'hour');
  eq('sidebar-defaults: sidebar.html does not hard-code "checked" attributes',
    /<input[^>]*checked/i.test(sidebarHtml), false);
  eq('sidebar-defaults: sidebar.html does not hard-code "selected" options',
    /<option[^>]*selected/i.test(sidebarHtml), false);
  eq('sidebar-defaults: sidebar.html loads constants.js before sidebar.js',
    /constants\.js[\s\S]*sidebar\.js/.test(sidebarHtml), true);
  eq('sidebar-defaults: sidebar.js applies DR_DEFAULTS to the UI on load',
    /applyDefaultsToUI[\s\S]*DR_DEFAULTS/.test(sidebarJsSource), true);
  eq('sidebar-defaults: manifest content_scripts load order is defaults, log buffer, dr-number package, dr-table package, dr-simplify package, messaging bus, store, ui-toggle, content',
    JSON.stringify(manifest.content_scripts[0].js) === JSON.stringify([
      'constants.js',
      'lib/dr-log/index.js',
      'lib/dr-number/rounding.js', 'lib/dr-number/core.js',
      'lib/dr-number/parsing.js', 'lib/dr-number/identifiers.js',
      'lib/dr-number/index.js',
      'lib/dr-table/detect.js', 'lib/dr-table/index.js',
      'lib/dr-simplify/ladder.js', 'lib/dr-simplify/index.js',
      'lib/dr-capture/state.js', 'lib/dr-capture/render.js',
      'lib/dr-capture/index.js',
      'adapters/messaging.js', 'app/store.js',
      'ui-toggle.js', 'ui-toast.js', 'content.js',
    ]), true);

  // AC3: (sidebar-tidyup) the old "section-heading" with "Include numbers in cells containing:"
  // was removed in the sidebar-tidyup sprint — no replacement test needed here.

  // AC4a: rangeSection div has "hidden" attribute.
  eq('sidebar-defaults: rangeSection has hidden attribute',
    /<div[^>]*id="rangeSection"[^>]*hidden/.test(sidebarHtml) ||
    /<div[^>]*hidden[^>]*id="rangeSection"/.test(sidebarHtml), true);

  // AC4b: rangeSection markup is still present (not deleted).
  eq('sidebar-defaults: rangeSection markup still present in HTML',
    sidebarHtml.includes('id="rangeSection"'), true);

  // AC5: parseRangeExpr is still defined (now in parsing.js after Phase 2 split).
  eq('sidebar-defaults: content scripts still define parseRangeExpr',
    /function parseRangeExpr\b/.test(allContentSrc), true);

  // AC6: manifest.json has a valid N.N.N version string.
  eq('sidebar-defaults: manifest version matches N.N.N',
    /^\d+\.\d+\.\d+$/.test(manifest.version), true);

  // AC7: manifest permissions do NOT include "storage".
  eq('sidebar-defaults: manifest permissions does not include "storage"',
    Array.isArray(manifest.permissions) && manifest.permissions.includes('storage'), false);

  // AC8: sidebar.js does not reference chrome.storage.sync.
  eq('sidebar-defaults: sidebar.js does not call chrome.storage.sync',
    /chrome\.storage\.sync/.test(sidebarJsSource), false);
  eq('sidebar-defaults: sidebar.js does not import chrome.storage',
    /chrome\.storage/.test(sidebarJsSource), false);
})();

// --- Static analysis: all new functions are defined ---

(function atToggle_staticAnalysis() {
  eq('auto-table-toggle: isTableRounded is defined',
    typeof isTableRounded, 'function');
  eq('auto-table-toggle: syncSwitchForTable is defined',
    typeof syncSwitchForTable, 'function');
  eq('auto-table-toggle: positionToggle is defined',
    typeof positionToggle, 'function');
  eq('auto-table-toggle: createToggleForTable is defined',
    typeof createToggleForTable, 'function');
  eq('auto-table-toggle: resetTable is defined',
    typeof resetTable, 'function');
  eq('auto-table-toggle: tableToggles WeakMap is defined',
    tableToggles instanceof WeakMap, true);
  eq('auto-table-toggle: trackedTables Set is defined',
    trackedTables instanceof Set, true);
})();

// --- Regression guard: content.js declares the new infrastructure ---

(function atToggle_contentJsDeclarations() {
  // Toggle widget infrastructure lives in ui-toggle.js after the Phase 2 split;
  // scan the combined content-script source so the contract is location-agnostic.
  const src = allContentSrc;
  eq('auto-table-toggle: declares tableToggles WeakMap',
    /const\s+tableToggles\s*=\s*new\s+WeakMap/.test(src), true);
  eq('auto-table-toggle: declares trackedTables Set',
    /const\s+trackedTables\s*=\s*new\s+Set/.test(src), true);
  eq('auto-table-toggle: defines isTableRounded',
    /function\s+isTableRounded\b/.test(src), true);
  eq('auto-table-toggle: defines syncSwitchForTable',
    /function\s+syncSwitchForTable\b/.test(src), true);
  eq('auto-table-toggle: defines positionToggle',
    /function\s+positionToggle\b/.test(src), true);
  eq('auto-table-toggle: defines createToggleForTable',
    /function\s+createToggleForTable\b/.test(src), true);
  eq('auto-table-toggle: defines injectTableToggles',
    /function\s+injectTableToggles\b/.test(src), true);
  // The toggle button must use the new dr-ext-morph CSS class
  eq('auto-table-toggle: toggle uses dr-ext-morph CSS class',
    src.includes('dr-ext-morph'), true);
})();

// --- accessibility AC2: CSS contains :focus-visible with outline and !important ---
// Spec: the CSS string injected by ensureToggleStyleInjected contains a
//       :focus-visible rule with `outline` and `!important`.

(function accessibilityAC2_focusVisibleCSS() {
  const src = allContentSrc; // toggle CSS now in ui-toggle.js (Phase 2 split)

  eq('accessibility AC2: content.js CSS contains :focus-visible selector',
    src.includes(':focus-visible'), true);

  // Verify that some :focus-visible rule contains outline and !important.
  // The CSS template in content.js uses ${…} interpolation, so we search
  // for a line that contains both ':focus-visible' and 'outline' and '!important'
  // (they may be on the same line in the source, possibly spanning a template expression).
  const lines = src.split('\n');
  const focusOutlineLine = lines.find(l =>
    l.includes(':focus-visible') && l.includes('outline'));
  const focusImportantLine = lines.find(l =>
    l.includes(':focus-visible') && l.includes('!important'));

  eq('accessibility AC2: :focus-visible rule contains outline property',
    focusOutlineLine !== undefined, true);

  eq('accessibility AC2: :focus-visible rule uses !important',
    focusImportantLine !== undefined, true);
})();

// --- Constants vs literals check ---
// Spec (AC §3.5 + last AC bullet): geometry literals must only appear as constant declarations.
// Soft check: the constant names TOGGLE_DOT_PX etc. appear in the CSS template block.

(function morphAC_constantsUsedInCSS() {
  const src = allContentSrc; // toggle geometry now in ui-toggle.js (Phase 2 split)

  // The CSS function body should contain interpolations of the constants, not bare literals.
  // We extract the ensureToggleStyleInjected function body as a rough string.
  const fnStart = src.indexOf('function ensureToggleStyleInjected');
  const fnEnd = src.indexOf('\nfunction ', fnStart + 1);
  const fnBody = fnStart !== -1 ? src.slice(fnStart, fnEnd !== -1 ? fnEnd : fnStart + 3000) : '';

  eq('expanding-toggle: TOGGLE_HIT_PAD_PX referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_HIT_PAD_PX'), true);
  eq('expanding-toggle: TOGGLE_DOT_PX referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_DOT_PX'), true);
  eq('expanding-toggle: TOGGLE_PILL_WIDTH_PX referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_PILL_WIDTH_PX'), true);
  eq('expanding-toggle: TOGGLE_PILL_HEIGHT_PX referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_PILL_HEIGHT_PX'), true);
  eq('expanding-toggle: TOGGLE_KNOB_PX referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_KNOB_PX'), true);
  eq('expanding-toggle: TOGGLE_COLOR_ON referenced in ensureToggleStyleInjected',
    fnBody.includes('TOGGLE_COLOR_ON'), true);

  // positionToggle body should reference the geometry constants
  const ptStart = src.indexOf('function positionToggle');
  const ptEnd = src.indexOf('\nfunction ', ptStart + 1);
  const ptBody = ptStart !== -1 ? src.slice(ptStart, ptEnd !== -1 ? ptEnd : ptStart + 1000) : '';

  eq('expanding-toggle: TOGGLE_HIT_PAD_PX referenced in positionToggle',
    ptBody.includes('TOGGLE_HIT_PAD_PX'), true);
  eq('expanding-toggle: TOGGLE_DOT_PX referenced in positionToggle',
    ptBody.includes('TOGGLE_DOT_PX'), true);
  eq('expanding-toggle: TOGGLE_DOT_OVERLAP_PX referenced in positionToggle',
    ptBody.includes('TOGGLE_DOT_OVERLAP_PX'), true);
  eq('expanding-toggle: TOGGLE_DOT_OVERHANG_PX referenced in positionToggle',
    ptBody.includes('TOGGLE_DOT_OVERHANG_PX'), true);
})();

(function previewBand_manifestLoadsRoundingJs() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  eq('manifest content_scripts loads lib/dr-number/rounding.js between constants.js and content.js',
    manifest.content_scripts[0].js[2], 'lib/dr-number/rounding.js');
})();

// The extracted layers (the lib/dr-number package: rounding.js, core.js,
// parsing.js, index.js; the lib/dr-table package: detect.js, index.js; plus
// ui-toggle.js) must all load AFTER constants.js and BEFORE content.js —
// content.js runs last because it holds the only load-time-executing code
// (listeners and the MutationObserver wiring). This ordering is duplicated in
// three places (manifest content_scripts, sidebar.html, and this harness's
// eval concatenation); they must stay in lockstep.
(function layerLoadOrderAcrossEntryPoints() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  const js = manifest.content_scripts[0].js;
  const after = (a, b) => js.indexOf(a) > -1 && js.indexOf(b) > -1 && js.indexOf(a) < js.indexOf(b);
  eq('manifest: rounding.js < core.js < parsing.js < dr-number index.js < detect.js < dr-table index.js < ladder.js < dr-simplify index.js < messaging.js < store.js < ui-toggle.js < ui-toast.js < content.js',
    after('lib/dr-number/rounding.js', 'lib/dr-number/core.js') &&
    after('lib/dr-number/core.js', 'lib/dr-number/parsing.js') &&
    after('lib/dr-number/parsing.js', 'lib/dr-number/index.js') &&
    after('lib/dr-number/index.js', 'lib/dr-table/detect.js') &&
    after('lib/dr-table/detect.js', 'lib/dr-table/index.js') &&
    after('lib/dr-table/index.js', 'lib/dr-simplify/ladder.js') &&
    after('lib/dr-simplify/ladder.js', 'lib/dr-simplify/index.js') &&
    after('lib/dr-simplify/index.js', 'adapters/messaging.js') &&
    after('adapters/messaging.js', 'app/store.js') &&
    after('app/store.js', 'ui-toggle.js') &&
    after('ui-toggle.js', 'ui-toast.js') &&
    after('ui-toast.js', 'content.js'), true);
  eq('manifest: content.js loads last', js[js.length - 1], 'content.js');

  // The sidebar deliberately does NOT load the content-only layers — it only
  // needs the pure domain (defaults, rounding, core).
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  eq('sidebar.html loads lib/dr-number/core.js after lib/dr-number/rounding.js and before sidebar.js',
    /lib\/dr-number\/rounding\.js[\s\S]*lib\/dr-number\/core\.js[\s\S]*sidebar\.js/.test(sidebarHtml), true);
  eq('sidebar.html does not load content-only lib/dr-number/parsing.js', sidebarHtml.includes('lib/dr-number/parsing.js'), false);
  eq('sidebar.html does not load content-only lib/dr-number/index.js', sidebarHtml.includes('lib/dr-number/index.js'), false);
  eq('sidebar.html does not load content-only lib/dr-table/detect.js', sidebarHtml.includes('lib/dr-table/detect.js'), false);
  eq('sidebar.html does not load content-only lib/dr-table/index.js', sidebarHtml.includes('lib/dr-table/index.js'), false);
  eq('sidebar.html does not load content-only lib/dr-simplify/ladder.js', sidebarHtml.includes('lib/dr-simplify/ladder.js'), false);
  eq('sidebar.html does not load content-only lib/dr-simplify/index.js', sidebarHtml.includes('lib/dr-simplify/index.js'), false);
  eq('sidebar.html does not load content-only ui-toggle.js', sidebarHtml.includes('ui-toggle.js'), false);
  eq('sidebar.html does not load content-only ui-toast.js', sidebarHtml.includes('ui-toast.js'), false);

  // NOTE: the main bootstrap eval() (the setup piece) no longer concatenates
  // coreCode/parsingCode/detectCode/uiToggleCode/code directly — it evals
  // the manifest-driven contentScriptBundle instead (see the
  // manifestDrivenSourceLoading self-test below for that ordering guarantee).
  // This assertion instead checks that later per-layer eval sites in the suite
  // (e.g. the x-floor sandbox concatenation) still reference those variables
  // in layer order, since a few sections still build their own eval string
  // from the individual layer sources.
  const testsSource = SUITE_SOURCE;
  eq('tests.js: per-layer eval sites reference core→parsing→detect→ui-toggle→content in layer order',
    /coreCode[\s\S]*parsingCode[\s\S]*detectCode[\s\S]*uiToggleCode[\s\S]*code\b/.test(
      testsSource.slice(testsSource.indexOf('eval('))), true);
})();

(function previewBand_sidebarHtmlHasBands() {
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  eq('sidebar.html has #topBand', /<div[^>]*id="topBand"/.test(sidebarHtml), true);
  eq('sidebar.html has #botBand', /<div[^>]*id="botBand"/.test(sidebarHtml), true);
  eq('sidebar.html loads lib/dr-number/rounding.js before sidebar.js',
    /lib\/dr-number\/rounding\.js[\s\S]*sidebar\.js/.test(sidebarHtml), true);
})();

// ---------------------------------------------------------------------------
// Sprint sidebar-tidyup: flat toggle list, new defaults, switch wrappers
// ---------------------------------------------------------------------------

(function sprintSidebarTidyup() {
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');

  // ── AC1: options section has exactly seven toggle rows in the canonical order ──
  // Parse all toggle-label texts inside #optionsSection.
  // Strategy: extract the optionsSection fragment, then collect every
  // class="toggle-label" span's text content via a simple regex.
  const optionsSectionMatch = sidebarHtml.match(/<div[^>]*id="optionsSection"[^>]*>([\s\S]*?)<\/div>\s*\n\s*<div/);
  // Fallback: grab everything between id="optionsSection"> and the next sibling div
  const optsSectionRaw = (() => {
    const start = sidebarHtml.indexOf('id="optionsSection"');
    if (start === -1) return '';
    const tagEnd = sidebarHtml.indexOf('>', start);
    // Walk forward tracking open/close divs to extract the full container
    let depth = 1;
    let i = tagEnd + 1;
    while (i < sidebarHtml.length && depth > 0) {
      const nextOpen  = sidebarHtml.indexOf('<div', i);
      const nextClose = sidebarHtml.indexOf('</div>', i);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) { depth++; i = nextOpen + 4; }
      else { depth--; if (depth === 0) { return sidebarHtml.slice(tagEnd + 1, nextClose); } i = nextClose + 6; }
    }
    return '';
  })();

  // Collect label texts in document order
  const labelRe = /class="toggle-label"[^>]*>([\s\S]*?)<\/span>/g;
  const labelTexts = [];
  let lm;
  while ((lm = labelRe.exec(optsSectionRaw)) !== null) {
    labelTexts.push(lm[1].trim());
  }

  const expectedOrder = ['words', 'currencies', 'percentages', 'dates', 'times', 'first row', 'first column'];

  eq('sidebar-tidyup AC1: options section has exactly 7 toggle rows',
    labelTexts.length, 7);

  eq('sidebar-tidyup AC1: toggle rows are in canonical order',
    labelTexts, expectedOrder);

  // ── AC2: forbidden phrases do not appear anywhere in the options section ──

  const forbidden = [
    'Include numbers in cells containing',
    'Exclude:',
    'round to:'
  ];
  for (const phrase of forbidden) {
    eq(`sidebar-tidyup AC2: "${phrase}" absent from options section`,
      optsSectionRaw.includes(phrase), false);
  }

  // Also check the full HTML for the same forbidden phrases (belt-and-braces)
  for (const phrase of forbidden) {
    eq(`sidebar-tidyup AC2 (full HTML): "${phrase}" absent`,
      sidebarHtml.includes(phrase), false);
  }

  // ── AC3: DR_DEFAULTS has the seven expected values ──

  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyMixedCells is true',
    DR_DEFAULTS.simplifyMixedCells, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyMixedCurrency is true',
    DR_DEFAULTS.simplifyMixedCurrency, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyMixedPercent is true',
    DR_DEFAULTS.simplifyMixedPercent, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyDates is true',
    DR_DEFAULTS.simplifyDates, true);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyTimes is false',
    DR_DEFAULTS.simplifyTimes, false);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyFirstRow is false',
    DR_DEFAULTS.simplifyFirstRow, false);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.simplifyFirstColumn is false',
    DR_DEFAULTS.simplifyFirstColumn, false);
  eq('sidebar-tidyup AC3: DR_DEFAULTS.dateGranularity is "year"',
    DR_DEFAULTS.dateGranularity, 'year');
  eq('sidebar-tidyup AC3: DR_DEFAULTS.timeGranularity is "hour"',
    DR_DEFAULTS.timeGranularity, 'hour');

  // ── AC4: every option-row checkbox is wrapped in a .switch element ──
  // For each of the seven option inputs by id, verify there is a parent
  // element with class "switch" enclosing the input.
  const optionInputIds = [
    'simplifyMixedCells', 'simplifyMixedCurrency', 'simplifyMixedPercent',
    'simplifyDates', 'simplifyTimes', 'simplifyFirstRow', 'simplifyFirstColumn'
  ];
  for (const id of optionInputIds) {
    // Match <label class="switch"> ... <input ... id="<id>"> ... </label>
    // OR <span class="switch"> ... <input ... id="<id>"> ... </span>
    const switchWrapRe = new RegExp(
      '<(?:label|span)[^>]*class="[^"]*\\bswitch\\b[^"]*"[^>]*>[\\s\\S]{0,300}' +
      '<input[^>]*id="' + id + '"',
      'm'
    );
    eq(`sidebar-tidyup AC4: #${id} is wrapped in a .switch element`,
      switchWrapRe.test(sidebarHtml), true);
  }

  // ── AC5: #timeGranularity <select> lists hour first, minute second ──
  // Extract the <select id="timeGranularity"> element and check option order.
  const timeSelectMatch = sidebarHtml.match(/<select[^>]*id="timeGranularity"[^>]*>([\s\S]*?)<\/select>/);
  const timeSelectHtml = timeSelectMatch ? timeSelectMatch[1] : '';

  const timeOptionRe = /value="([^"]+)"/g;
  const timeOptionValues = [];
  let tom;
  while ((tom = timeOptionRe.exec(timeSelectHtml)) !== null) {
    timeOptionValues.push(tom[1]);
  }

  eq('sidebar-tidyup AC5: #timeGranularity has exactly 2 options',
    timeOptionValues.length, 2);
  eq('sidebar-tidyup AC5: first option is "hour"',
    timeOptionValues[0], 'hour');
  eq('sidebar-tidyup AC5: second option is "minute"',
    timeOptionValues[1], 'minute');
})();

// =============================================================================
// Sprint sidebar-pill-left: toggle switch appears left of label in every row
// =============================================================================
//
// Acceptance criteria:
//   AC1. In every option row the switch (<label class="switch">) comes before
//        the .toggle-label text node — verified by comparing indexOf positions
//        of the checkbox <input> vs <span class="toggle-label"> within each row.
//   AC2. On the dates/times rows the <select id="dateGranularity"> /
//        <select id="timeGranularity"> is the last element — its index appears
//        AFTER the .toggle-label in the row substring.
//   AC3. sidebar.html does NOT contain "row-reverse" anywhere.
//   AC4. The .toggle-row CSS block does NOT contain "justify-content: space-between".

(function sidebarPillLeft() {
  const sidebarPath = path.join(__dirname, 'sidebar.html');
  const sidebarHtml = fs.readFileSync(sidebarPath, 'utf8');

  // Helper: extract the substring of sidebarHtml that covers the .toggle-row
  // whose checkbox has the given id. We find the opening <div class="toggle-row">
  // that contains id="<rowId>" and slice up to the matching </div>.
  function getRowSubstring(rowId) {
    // Find the checkbox input for this id within the full source.
    const inputPattern = new RegExp('id=["\']' + rowId + '["\']');
    const inputIdx = sidebarHtml.search(inputPattern);
    if (inputIdx === -1) return null;

    // Walk backwards to the nearest <div class="toggle-row"> opening tag.
    const beforeInput = sidebarHtml.slice(0, inputIdx);
    const divStart = beforeInput.lastIndexOf('<div class="toggle-row">');
    if (divStart === -1) return null;

    // Walk forwards to find the matching closing </div>.
    // We look for the first </div> that closes the outermost .toggle-row div.
    const fromDiv = sidebarHtml.slice(divStart);
    // Scan for the first </div> after the opening tag (these rows have no nested divs).
    const closeIdx = fromDiv.indexOf('</div>');
    if (closeIdx === -1) return null;

    return fromDiv.slice(0, closeIdx + '</div>'.length);
  }

  // --- AC1: switch appears before .toggle-label in each option row ---
  // Rows to check: simplifyMixedCells, simplifyFirstColumn (simple), simplifyDates, simplifyTimes.
  const simpleRows = ['simplifyMixedCells', 'simplifyFirstColumn'];
  for (const id of simpleRows) {
    const row = getRowSubstring(id);
    eq(`sidebar-pill-left AC1: row "${id}" exists in sidebar.html`,
      row !== null, true);
    if (row !== null) {
      const inputIdx = row.search(new RegExp('id=["\']' + id + '["\']'));
      const labelIdx = row.indexOf('<span class="toggle-label">');
      eq(`sidebar-pill-left AC1: switch input comes before .toggle-label in row "${id}"`,
        inputIdx < labelIdx, true);
    }
  }

  // Also check the date and time rows (they have a <select> too).
  const complexRows = ['simplifyDates', 'simplifyTimes'];
  for (const id of complexRows) {
    const row = getRowSubstring(id);
    eq(`sidebar-pill-left AC1: row "${id}" exists in sidebar.html`,
      row !== null, true);
    if (row !== null) {
      const inputIdx = row.search(new RegExp('id=["\']' + id + '["\']'));
      const labelIdx = row.indexOf('<span class="toggle-label">');
      eq(`sidebar-pill-left AC1: switch input comes before .toggle-label in row "${id}"`,
        inputIdx < labelIdx, true);
    }
  }

  // --- AC2: <select> is the last element (after .toggle-label) in dates/times rows ---
  const selectPairs = [
    { rowId: 'simplifyDates',  selectId: 'dateGranularity' },
    { rowId: 'simplifyTimes',  selectId: 'timeGranularity' },
  ];
  for (const { rowId, selectId } of selectPairs) {
    const row = getRowSubstring(rowId);
    if (row !== null) {
      const labelIdx  = row.indexOf('<span class="toggle-label">');
      const selectIdx = row.search(new RegExp('<select[^>]*id=["\']' + selectId + '["\']'));
      eq(`sidebar-pill-left AC2: <select id="${selectId}"> appears after .toggle-label in row`,
        selectIdx > labelIdx, true);
    }
  }

  // --- AC3: sidebar.html does not use row-reverse ---
  eq('sidebar-pill-left AC3: sidebar.html does not contain "row-reverse"',
    sidebarHtml.includes('row-reverse'), false);

  // --- AC4: .toggle-row CSS block does not use justify-content: space-between ---
  // Find the .toggle-row block by locating ".toggle-row {" and scanning to the closing "}".
  const toggleRowBlockStart = sidebarHtml.indexOf('.toggle-row {');
  eq('sidebar-pill-left AC4: .toggle-row CSS block is present in sidebar.html',
    toggleRowBlockStart !== -1, true);
  if (toggleRowBlockStart !== -1) {
    const fromBlock = sidebarHtml.slice(toggleRowBlockStart);
    const blockClose = fromBlock.indexOf('}');
    const toggleRowBlock = blockClose !== -1 ? fromBlock.slice(0, blockClose + 1) : fromBlock.slice(0, 200);
    eq('sidebar-pill-left AC4: .toggle-row CSS block does not contain "justify-content: space-between"',
      toggleRowBlock.includes('justify-content: space-between'), false);
  }
})();

// --- AC5: sidebar.js updateDisabledState wires granularity dropdowns to toggles ---
// The harness has no live sidebar DOM, so we verify via static source analysis.
// We assert:
//   (a) updateDisabledState references dateGranularity.disabled and !simplifyDates
//   (b) updateDisabledState references timeGranularity.disabled and !simplifyTimes
// This proves the boolean is wired the correct way round in the sidebar source.
(function invertPills_AC5_sidebarDisabledStateStaticAnalysis() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // dateGranularity.disabled must be set to !simplifyDates (true when OFF, false when ON)
  eq('invert-pills AC5: sidebar.js sets dateGranularity.disabled = !simplifyDates',
    /dateGranularityEl\.disabled\s*=\s*!document\.getElementById\(['"]simplifyDates['"]\)\.checked/.test(sidebarSrc),
    true);

  // timeGranularity.disabled must be set to !simplifyTimes
  eq('invert-pills AC5: sidebar.js sets timeGranularity.disabled = !simplifyTimes',
    /timeGranularityEl\.disabled\s*=\s*!document\.getElementById\(['"]simplifyTimes['"]\)\.checked/.test(sidebarSrc),
    true);

  // updateDisabledState function must still exist (not deleted or renamed)
  eq('invert-pills AC5: sidebar.js defines updateDisabledState',
    /function updateDisabledState\b/.test(sidebarSrc), true);
})();

// --- Old keys (excludeDates / excludeTimes) must be absent from content.js and constants.js ---
// These were renamed to simplifyDates/simplifyTimes in this sprint.
// If the old names are still present as property assignments or conditions, the
// inversion is incomplete and rounding behaviour would be controlled by the wrong key.
(function invertPills_oldKeysAbsent() {
  const contentSrc = sourceByName('content.js');
  // Sprint merge-ladder moved the simplifyDates/simplifyTimes option reads
  // (and every other classification-ladder rule) out of content.js and into
  // lib/dr-simplify/ladder.js; content.js now only calls classifyCell.
  const ladderSrc = sourceByName('lib/dr-simplify/ladder.js');
  if (contentSrc === null || constantsCode === null || ladderSrc === null) {
    eq('invert-pills regression: source files present in manifest', false, true);
    return;
  }
  const sidebarSrc  = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');

  // "excludeDates" and "excludeTimes" must not appear as identifiers in any of these files.
  eq('invert-pills regression: content.js does not reference excludeDates',
    /\bexcludeDates\b/.test(contentSrc), false);
  eq('invert-pills regression: content.js does not reference excludeTimes',
    /\bexcludeTimes\b/.test(contentSrc), false);
  eq('invert-pills regression: constants.js does not reference excludeDates',
    /\bexcludeDates\b/.test(constantsCode), false);
  eq('invert-pills regression: constants.js does not reference excludeTimes',
    /\bexcludeTimes\b/.test(constantsCode), false);
  eq('invert-pills regression: sidebar.js does not reference excludeDates',
    /\bexcludeDates\b/.test(sidebarSrc), false);
  eq('invert-pills regression: sidebar.js does not reference excludeTimes',
    /\bexcludeTimes\b/.test(sidebarSrc), false);
  eq('invert-pills regression: lib/dr-simplify/ladder.js does not reference excludeDates',
    /\bexcludeDates\b/.test(ladderSrc), false);
  eq('invert-pills regression: lib/dr-simplify/ladder.js does not reference excludeTimes',
    /\bexcludeTimes\b/.test(ladderSrc), false);

  // Conversely, simplifyDates and simplifyTimes MUST appear in each file.
  // content.js references them only transitively now (via opts passed to
  // classifyCell) — the ladder is the actual point of use.
  eq('invert-pills regression: lib/dr-simplify/ladder.js references simplifyDates',
    /\bsimplifyDates\b/.test(ladderSrc), true);
  eq('invert-pills regression: lib/dr-simplify/ladder.js references simplifyTimes',
    /\bsimplifyTimes\b/.test(ladderSrc), true);
  eq('invert-pills regression: constants.js references simplifyDates',
    /\bsimplifyDates\b/.test(constantsCode), true);
  eq('invert-pills regression: constants.js references simplifyTimes',
    /\bsimplifyTimes\b/.test(constantsCode), true);
  eq('invert-pills regression: sidebar.js references simplifyDates',
    /\bsimplifyDates\b/.test(sidebarSrc), true);
  eq('invert-pills regression: sidebar.js references simplifyTimes',
    /\bsimplifyTimes\b/.test(sidebarSrc), true);
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

// ---------------------------------------------------------------------------
// AC4: background.js does NOT relay state:tableEnabledChanged when sidebarTabId is null.
//
// background.js runs in a service-worker context without the DOM and module
// system our harness uses, so we can't eval() it directly alongside the content
// scripts. Instead we test the guard at two levels:
//   (a) Static analysis: the source contains the null-guard exactly as specced.
//   (b) Extracted-logic test: inline a minimal reproduction of the guard and
//       verify its branching behaviour, confirming the written code is correct.
// ---------------------------------------------------------------------------

// --- #325 Task 8: the on/off report reaches the sidebar exactly once ---
//
// The content script broadcasts the on/off report to every extension page,
// which already includes the open sidebar. The worker used to receive that
// broadcast and send it again, so the sidebar redrew twice on one fact, and
// the worker guarded the re-send on holding a sidebar tab number to keep the
// second delivery from going out with no sidebar open. The relay is gone, and
// with it the guard it needed. What replaces both: one publisher, one
// delivery.
(function onOffReportDeliveredOnce() {
  const bgSrc = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');
  eq('one delivery: the worker subscribes to no on/off report',
    /subscribe\(\s*'state:tableEnabledChanged'/.test(bgSrc), false);
  eq('one delivery: the worker publishes no on/off report',
    /publish\(\s*'state:tableEnabledChanged'/.test(bgSrc), false);
  eq('one delivery: the worker makes no wire send of its own for anything',
    bgSrc.includes('chrome.runtime.sendMessage'), false);
})();

// ---------------------------------------------------------------------------
// Sprint extract-dr-table (adversarial hardening): static purity scan.
// Detection functions (findTargetTable, findTables, looksLikeGrid, isDataTable,
// isPhantomA11yTable) must never write to the page — no classList.add,
// createElement, appendChild, or createToggleForTable inside their bodies.
// Write-layer helpers (applyExtractedPatches,
// restoreTextPieces, GridAdapter's applyPatches) legitimately create/mutate nodes and are correctly
// excluded from this scan — they are reachable only from explicit write calls
// (roundTable / reapplyRounding), never from detection.
// ---------------------------------------------------------------------------
(function detectionFunctions_sourceScan_noPageWrites() {
  if (detectCode === null) {
    eq('purity scan: source file lib/dr-table/detect.js present in manifest', false, true);
    return;
  }
  const FORBIDDEN = ['classList.add', 'createElement', 'appendChild', 'createToggleForTable'];
  const DETECTION_FNS = ['findTargetTable', 'findTables', 'looksLikeGrid', 'isDataTable', 'isPhantomA11yTable'];

  // Extract a top-level `function name(` body by brace-matching from the
  // opening brace to its balanced close. Good enough for this file's flat,
  // non-string-brace-heavy source.
  function extractFunctionBody(src, fnName) {
    const sig = new RegExp(`function ${fnName}\\s*\\(`);
    const m = sig.exec(src);
    if (!m) return null;
    const braceStart = src.indexOf('{', m.index);
    if (braceStart === -1) return null;
    let depth = 0;
    for (let i = braceStart; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) return src.slice(braceStart, i + 1);
      }
    }
    return null;
  }

  for (const fnName of DETECTION_FNS) {
    const body = extractFunctionBody(detectCode, fnName);
    eq(`purity scan: ${fnName} body located in lib/dr-table/detect.js`, body !== null, true);
    if (body === null) continue;
    for (const token of FORBIDDEN) {
      eq(`purity scan: ${fnName} does not call/reference "${token}"`,
        body.includes(token), false);
    }
  }
})();

// AC2 (live): flashSidebarContainer in sidebar.js logic — exercised via a
// minimal eval of sidebar.js with a capturing document.body stub.
// sidebar.js calls document.getElementById at module scope, so we must provide
// a full-enough stub to get past those calls before onMessage.addListener fires.
(function tableContextmenuActivation_sidebarFlash() {
  const bodyClasses = new Set();
  let animEndListener = null;
  const captureBody = {
    classList: {
      remove(cls) { bodyClasses.delete(cls); },
      add(cls)    { bodyClasses.add(cls); },
      contains(cls) { return bodyClasses.has(cls); },
      // The sidebar's opening read runs after the tab lookup now, and it
      // reaches this on the way (issue #343). Without it the eval stops
      // before the lookup and the sidebar binds to no tab.
      toggle(cls, force) {
        if (force === undefined) {
          if (bodyClasses.has(cls)) bodyClasses.delete(cls); else bodyClasses.add(cls);
        } else if (force) bodyClasses.add(cls); else bodyClasses.delete(cls);
      },
    },
    get offsetWidth() { return 0; },
    addEventListener(type, fn, opts) {
      if (type === 'animationend') animEndListener = fn;
    },
  };

  // Minimal element stub — covers getElementById and createElement usages.
  function makeEl() {
    const el = {
      addEventListener() {},
      removeEventListener() {},
      classList: {
        add() {}, remove() {}, contains() { return false; },
        toggle() {},
      },
      style: {},
      value: '',
      checked: false,
      disabled: false,
      textContent: '',
      innerHTML: '',
      appendChild() {},
      querySelector()    { return makeEl(); },
      querySelectorAll() { return []; },
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
      matches()  { return false; },
      // The sidebar tags its status message with a source and clears the tag
      // again. Without this the eval stops there, before the tab lookup the
      // opening read now runs behind (issue #343).
      dataset: {},
      closest()  { return null; },
    };
    return el;
  }

  const captureDoc2 = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: captureBody,
    getElementById() { return makeEl(); },
    createElement()  { return makeEl(); },
  };

  // Minimal stubs for sidebar.js dependencies.
  const savedDoc    = global.document;
  const savedChrome = global.chrome;
  const savedWindow = global.window;

  global.document = captureDoc2;
  global.chrome = {
    runtime: {
      onMessage: { addListener: () => {} },
      sendMessage: () => {},
    },
    // The sidebar records the tab it was opened for and acts only on reports
    // from that tab (issue #343), so this harness answers with one. No
    // sendMessage: the opening read then goes unanswered and the sidebar
    // falls to its unbound state, which is what this section already assumed.
    tabs: {
      query(q, cb) { cb([{ id: SIDEBAR_HARNESS_TAB }]); },
      onActivated: { addListener() {} },
    },
  };
  global.window = {
    addEventListener() {},
    close() {},
    getComputedStyle: () => ({ display: 'block' }),
  };

  let capturedOnMessageHandler = null;
  global.chrome.runtime.onMessage.addListener = (fn) => { capturedOnMessageHandler = fn; };
  const roundingSrcForFlash = sourceByName('lib/dr-number/rounding.js');
  const coreSrcForFlash = sourceByName('lib/dr-number/core.js');
  if (constantsCode === null || roundingSrcForFlash === null || coreSrcForFlash === null) {
    eq('table-activation AC2 live: source files (defaults/rounding/core) present in manifest',
      false, true);
    global.document = savedDoc;
    global.chrome   = savedChrome;
    global.window   = savedWindow;
    return;
  }

  try {
    const dir = path.join(__dirname);
    // The bus goes in the same eval as sidebar.js, so the sidebar's
    // subscriptions attach to a bus of its own. Without it DR_BUS resolves to
    // the content-script bundle's global one, and every report the content
    // script publishes would run a half-built sidebar's handler — a crossing
    // the browser cannot make, because the two run in separate contexts.
    eval(
      constantsCode + '\n' +
      roundingSrcForFlash + '\n' +
      coreSrcForFlash     + '\n' +
      messagingCode + '\n' +
      fs.readFileSync(path.join(dir, 'sidebar.js'), 'utf8')
    );
  } catch(e) {
    // sidebar.js may reference DOM elements that are not fully stubbed — that is
    // acceptable; we only need the onMessage handler to be captured before the crash.
  }

  // Exercise the handler WHILE global.document still points to captureDoc2 so
  // that flashSidebarContainer can reach captureBody via document.body.
  eq('table-activation AC2 live: sidebar onMessage handler was captured',
    typeof capturedOnMessageHandler, 'function');

  if (typeof capturedOnMessageHandler === 'function') {
    // Invoke the state:tableActivated message and verify the flash class is applied.
    capturedOnMessageHandler({ action: 'state:tableActivated' }, FROM_SIDEBAR_TAB, () => {});

    eq('table-activation AC2 live: state:tableActivated message adds dr-sidebar-flash to document.body',
      bodyClasses.has('dr-sidebar-flash'),
      true);

    // Simulate animationend — the class should be removed afterwards.
    if (typeof animEndListener === 'function') animEndListener();
    eq('table-activation AC2 live: dr-sidebar-flash removed after animationend',
      bodyClasses.has('dr-sidebar-flash'),
      false);
  }

  // Restore globals after the assertions have run.
  global.document = savedDoc;
  global.chrome   = savedChrome;
  global.window   = savedWindow;
})();

// AC4 (runtime): the worker relays no activation report into a tab, whether or
// not it holds a sidebar tab number. The relay retired before #325; what #325
// changes is where the claim is read from — the worker holds no message
// listener of its own now, so the listener under test is the bus's, and the
// worker's own subscriptions are the only thing that could act on an arriving
// topic. It subscribes to no activation report, so nothing does.
(function tableContextmenuActivation_backgroundRelay() {
  const sentTabMessages = [];
  let capturedBgHandler = null;
  let capturedClickHandler = null;

  const captureChromeBg = {
    runtime: {
      lastError: null,
      onInstalled: { addListener: () => {} },
      onMessage:   { addListener: (fn) => { capturedBgHandler = fn; } },
      sendMessage: (msg, cb) => { if (cb) cb(undefined); },
    },
    contextMenus: {
      create: () => {},
      update: () => {},
      onClicked: { addListener: (fn) => { capturedClickHandler = fn; } },
    },
    tabs: {
      query(q, cb) { cb([{ id: 1 }]); },
      sendMessage(tabId, msg, cb) { sentTabMessages.push({ tabId, msg }); if (cb) cb(undefined); },
      onUpdated:   { addListener: () => {} },
      onRemoved:   { addListener: () => {} },
      onActivated: { addListener: () => {} },
    },
    // Omitted deliberately: background.js guards on chrome.sidePanel, so with
    // it absent the sidebar-open handler never awaits and the tab number is
    // set by the time the call returns.
  };

  // Every handler call runs while the stub is the global chrome. The bus reads
  // chrome at send time, not at load time, so a call made after the restore
  // below would send through the suite's bare default stub and reach nothing.
  const PANEL_TAB = 99;
  const result = {};
  const savedChrome = global.chrome;
  global.chrome = captureChromeBg;
  try {
    eval(messagingCode + '\n' +
      fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8'));
    result.listenerType = typeof capturedBgHandler;
    if (result.listenerType === 'function') {
      // Case A: no sidebar tab number (never opened).
      sentTabMessages.length = 0;
      capturedBgHandler({ action: 'state:tableActivated' }, {}, () => {});
      result.relaysWithNoTabNumber = sentTabMessages.length;

      // Case B: the sidebar was opened, so the worker holds its tab number.
      // The handler runs to completion synchronously with chrome.sidePanel
      // absent.
      sentTabMessages.length = 0;
      capturedClickHandler({ menuItemId: 'dr-action-sidebar' }, { id: PANEL_TAB });
      result.sentOpenedReport = sentTabMessages.some(m => m.tabId === PANEL_TAB &&
        m.msg && m.msg.action === 'state:sidebarOpened');

      sentTabMessages.length = 0;
      capturedBgHandler({ action: 'state:tableActivated' }, {}, () => {});
      result.relaysWithTabNumber = sentTabMessages.length;
    }
  } finally {
    global.chrome = savedChrome;
  }

  eq('table-activation AC4 runtime: the bus listener is the worker\'s only message listener',
    result.listenerType, 'function');
  eq('table-activation AC4 runtime: no relay when the worker holds no sidebar tab number',
    result.relaysWithNoTabNumber, 0);
  eq('table-activation AC4 runtime: opening the sidebar sends its report to that tab',
    result.sentOpenedReport, true);
  eq('table-activation AC4 runtime: still no relay once the worker holds one',
    result.relaysWithTabNumber, 0);
})();

// ---------------------------------------------------------------------------
// END Sprint table-contextmenu-activation tests
// ---------------------------------------------------------------------------

// Sprint advanced-lower-dot-brown: linked-state bot thumb/label colour change
// AC1. Linked-state bot thumb background is #c48a6a (brown), NOT grey #9aa0a6.
// AC2. Decoupled-state bot thumb is still #b3623d (unchanged).
// AC3. Linked-state bot LABEL color matches the linked thumb (same hex #c48a6a).
// AC4. Old grey #9aa0a6 no longer appears for either of these two rules.
// AC5. The linked brown (#c48a6a) is lighter than the decoupled brown (#b3623d).
// ---------------------------------------------------------------------------

(function advancedLowerDotBrown() {
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');

  // --- AC1: .dual-thumb.bot.linked background is #c48a6a ---
  eq('lower-dot-brown AC1: .dual-thumb.bot.linked background is #c48a6a',
    /\.dual-thumb\.bot\.linked\s*\{[^}]*background\s*:\s*#c48a6a/.test(sidebarHtml), true);

  // --- AC1 (negative): .dual-thumb.bot.linked does NOT use grey #9aa0a6 ---
  // Extract the specific rule so we don't false-positive on other rules.
  const linkedThumbRuleMatch = sidebarHtml.match(/\.dual-thumb\.bot\.linked\s*\{[^}]*\}/);
  const linkedThumbRule = linkedThumbRuleMatch ? linkedThumbRuleMatch[0] : '';
  eq('lower-dot-brown AC1 neg: .dual-thumb.bot.linked rule does not contain #9aa0a6',
    linkedThumbRule.includes('#9aa0a6'), false);

  // --- AC2: .dual-thumb.bot (decoupled) background is still #b3623d ---
  // The rule may be a multi-line block; match the .dual-thumb.bot { ... } block
  // that is NOT the .linked variant, and confirm it contains #b3623d.
  // Strategy: find the line/block for the rule selector without .linked.
  const decoupledRuleMatch = sidebarHtml.match(/\.dual-thumb\.bot\s*\{[^}]*\}/);
  const decoupledRule = decoupledRuleMatch ? decoupledRuleMatch[0] : '';
  eq('lower-dot-brown AC2: .dual-thumb.bot (decoupled) block is present in sidebar.html',
    decoupledRule.length > 0, true);
  eq('lower-dot-brown AC2: .dual-thumb.bot (decoupled) contains background #b3623d',
    decoupledRule.includes('#b3623d'), true);

  // --- AC3: Linked-state bot LABEL color is #c48a6a (matches the thumb) ---
  // Rule: #sliderBlock.linked .label-row .lbl.bot { color: #c48a6a; }
  eq('lower-dot-brown AC3: #sliderBlock.linked .lbl.bot color is #c48a6a',
    /#sliderBlock\.linked[^{]*\.lbl\.bot\s*\{[^}]*color\s*:\s*#c48a6a/.test(sidebarHtml), true);

  // Verify thumb and label use the EXACT same hex (AC3 consistency check).
  const linkedLabelMatch = sidebarHtml.match(/#sliderBlock\.linked[^{]*\.lbl\.bot\s*\{[^}]*color\s*:\s*(#[0-9a-fA-F]{6})/);
  const linkedThumbBgMatch = sidebarHtml.match(/\.dual-thumb\.bot\.linked\s*\{[^}]*background\s*:\s*(#[0-9a-fA-F]{6})/);
  const linkedLabelHex  = linkedLabelMatch  ? linkedLabelMatch[1].toLowerCase()  : 'MISSING';
  const linkedThumbHex  = linkedThumbBgMatch ? linkedThumbBgMatch[1].toLowerCase() : 'MISSING';
  eq('lower-dot-brown AC3 consistency: linked label hex === linked thumb hex',
    linkedLabelHex, linkedThumbHex);

  // --- AC4: Old grey #9aa0a6 no longer appears in either of these two rules ---
  // (linked thumb rule checked above; now check the linked label rule)
  const linkedLabelRuleMatch = sidebarHtml.match(/#sliderBlock\.linked[^{]*\.lbl\.bot\s*\{[^}]*\}/);
  const linkedLabelRule = linkedLabelRuleMatch ? linkedLabelRuleMatch[0] : '';
  eq('lower-dot-brown AC4: linked label rule does not contain #9aa0a6',
    linkedLabelRule.includes('#9aa0a6'), false);

  // --- AC5: The linked brown (#c48a6a) is lighter than the decoupled brown (#b3623d) ---
  // Parse each hex to RGB, then compute perceived lightness (simple average of R,G,B).
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  function lightness(rgb) { return (rgb.r + rgb.g + rgb.b) / 3; }

  const linkedBrown    = hexToRgb('#c48a6a');   // the new colour
  const decoupledBrown = hexToRgb('#b3623d');   // the existing decoupled colour
  eq('lower-dot-brown AC5: linked brown (#c48a6a) is lighter than decoupled brown (#b3623d)',
    lightness(linkedBrown) > lightness(decoupledBrown), true);
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

// ---------------------------------------------------------------------------
// Sprint detection-constants: every detection setting and both lookup
// lists now have one home, the detection settings (DR_DETECTION_SETTINGS, in
// the configuration file constants.js), with no behavior change. The
// pillbox auto-collapse delay, once beside them, lives in the pillbox view
// (ui-toggle.js) as its own constant: the view alone reads it. Four groups
// of tests:
//   1. Source scan: none of the eight retired names carries a second
//      const/let/var definition anywhere the manifest loads, and the two
//      retired literal forms (the repetition-share division, the bare
//      column-width-agreement literal) and the retired Set are gone from
//      the detection layer (lib/dr-table/detect.js).
//   2. Source scan: the detection layer and the controller (content.js)
//      read DR_DETECTION_SETTINGS as a bare global — no typeof guard, no
//      OR-fallback, no reassignment — and the pillbox view reads none of it.
//   3. Behavior: a sandbox that evaluates the configuration file and then
//      the detection layer carries the nine pre-move values unchanged, and
//      looksLikeGrid, findTargetTable, isPhantomA11yTable, and isDataTable
//      behave exactly as the pre-move source did, on fixtures whose outcome
//      the pre-move values determine.
//   4. Behavior: a sandbox that evaluates the detection layer alone, with
//      no configuration file, fails at load with a ReferenceError naming
//      DR_DETECTION_SETTINGS — before any function in the file runs.
// ---------------------------------------------------------------------------

(function detectionSettings_retiredNamesHaveNoSecondDefinition() {
  const RETIRED_NAMES = [
    'GRID_MIN_CHILDREN',
    'GRID_WALK_DEPTH_CAP',
    'GRID_COL_WIDTH_SAMPLE',
    'GRID_DISPLAY_VALUES',
    'GRID_REAPPLY_DEBOUNCE_MS',
    'OFFSCREEN_LEFT_PX_THRESHOLD',
    'DEFAULT_VENDOR_PROFILES',
    'TOUCH_AUTOCOLLAPSE_MS',
  ];
  // Every file the manifest loads, plus this suite itself — a retired name
  // could resurface as a second definition in either.
  const scannedSources = manifest.content_scripts[0].js
    .map((file) => sourceByName(file) || '')
    .concat([SUITE_SOURCE])
    .join('\n');

  for (const name of RETIRED_NAMES) {
    const definitionPattern = new RegExp(`\\b(const|let|var)\\s+${name}\\b`);
    eq(`detection settings: ${name} carries no const/let/var definition anywhere the manifest loads`,
      definitionPattern.test(scannedSources), false);
  }
})();

(function detectionSettings_retiredLiteralFormsAreGoneFromDetection() {
  const src = detectCode || '';
  eq('detection settings: the detection layer no longer computes the repetition floor as children.length / 2',
    /children\.length\s*\/\s*2/.test(src), false);
  eq('detection settings: the detection layer no longer compares column-width agreement to a bare 0.8 literal',
    />=\s*0\.8\b/.test(src), false);
  eq('detection settings: the detection layer no longer builds a Set of the four display values',
    /new Set\(\s*\[\s*['"]grid['"]/.test(src), false);
  eq('detection settings: the detection layer reads the display-value list through DR_DETECTION_SETTINGS.gridDisplayValues.includes(display)',
    /DR_DETECTION_SETTINGS\.gridDisplayValues\.includes\(display\)/.test(src), true);
})();

(function detectionSettings_noFallbackCopy() {
  const filesToScan = {
    'lib/dr-table/detect.js': detectCode,
    'content.js': sourceByName('content.js'),
  };
  for (const [file, src] of Object.entries(filesToScan)) {
    if (src === null || src === undefined) {
      eq(`detection settings: source file ${file} present in manifest`, false, true);
      continue;
    }
    eq(`detection settings: ${file} carries no typeof DR_DETECTION_SETTINGS guard`,
      /typeof\s+DR_DETECTION_SETTINGS\b/.test(src), false);
    eq(`detection settings: ${file} carries no DR_DETECTION_SETTINGS || fallback`,
      /DR_DETECTION_SETTINGS\s*\|\|/.test(src), false);
    eq(`detection settings: ${file} carries no window.DR_DETECTION_SETTINGS read`,
      /window\.DR_DETECTION_SETTINGS\b/.test(src), false);
    eq(`detection settings: ${file} carries no globalThis.DR_DETECTION_SETTINGS read`,
      /globalThis\.DR_DETECTION_SETTINGS\b/.test(src), false);
    eq(`detection settings: ${file} carries no DR_DETECTION_SETTINGS reassignment`,
      /\bDR_DETECTION_SETTINGS\s*=[^=]/.test(src), false);
  }
})();

// The pillbox view holds no detection setting: its touch auto-collapse
// delay is its own constant, so the view reads the detection settings
// nowhere and the settings carry no delay the view alone reads.
(function detectionSettings_pillboxViewHoldsItsOwnDelay() {
  const src = uiToggleCode || '';
  eq('detection settings: ui-toggle.js defines PILLBOX_AUTO_COLLAPSE_MS as its own constant',
    /^const PILLBOX_AUTO_COLLAPSE_MS = 3000;/m.test(src), true);
  eq('detection settings: ui-toggle.js reads DR_DETECTION_SETTINGS nowhere',
    /DR_DETECTION_SETTINGS/.test(src), false);
  eq('detection settings: the auto-collapse timer takes the view\'s own constant',
    /},\s*PILLBOX_AUTO_COLLAPSE_MS\);/.test(src), true);
  eq('detection settings: the settings carry no pillboxAutoCollapseMs key',
    Object.prototype.hasOwnProperty.call(DR_DETECTION_SETTINGS, 'pillboxAutoCollapseMs'), false);
})();

// Living docs: docs/design.md's package table and docs/vocabulary.md both
// carry the detection settings, per AGENTS.md's rule that a behavior-invalidating
// change updates every living doc it invalidates in the same branch.
(function detectionSettings_livingDocsCarryTheTerm() {
  const designMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'design.md'), 'utf8');
  const vocabularyMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'vocabulary.md'), 'utf8');
  eq('living docs: docs/design.md carries the detection settings',
    designMd.includes('detection settings'), true);
  eq('living docs: docs/vocabulary.md defines the detection settings',
    vocabularyMd.includes('detection settings'), true);
})();

// VendorProfiles: a custom list replaces the default, and GridAdapter honors
// it for scroll-container resolution — proving the port is genuinely
// pluggable, not just a constant renamed in place.
(function gridAdapter_customVendorProfilesHonored() {
  const scrollEl = { tagName: 'DIV', className: 'my-lib-scroll' };
  const wrapperEl = {
    tagName: 'DIV',
    className: 'my-lib-wrapper',
    matches() { return false; },
    querySelector(sel) {
      return sel === '.my-lib-scroll-container' ? scrollEl : null;
    },
  };
  const customProfiles = [
    { name: 'my-lib', classToken: 'my-lib-', scrollContainerSelectors: ['.my-lib-scroll-container'], pinnedPaneSelectors: [] },
  ];

  const adapter = new GridAdapter(wrapperEl, { vendorProfiles: customProfiles });
  eq('GridAdapter: a custom vendorProfiles scroll-container selector is honored',
    adapter._getScrollContainer(), scrollEl);

  // Sanity: the DEFAULT profiles do not know this vendor's selector, so the
  // custom list above is what made the resolution succeed, not a coincidence.
  const adapterDefault = new GridAdapter(wrapperEl, {});
  eq('GridAdapter: default vendorProfiles do not resolve an unrelated vendor selector (sanity)',
    adapterDefault._getScrollContainer(), wrapperEl);
})();

// --- AC6: both live scanners run the step and hold no ARIA pass of their own ---

(function gridNesting_AC6_neitherLiveScannerHoldsAnAriaPass() {
  const loadTimeScanSrc = sourceByName('ui-toggle.js');
  const addedNodePassSrc = sourceByName('content.js');

  eq('nesting AC6: the pillbox view is listed in the manifest', loadTimeScanSrc !== null, true);
  eq('nesting AC6: the controller is listed in the manifest', addedNodePassSrc !== null, true);
  eq('nesting AC6: the load-time scan names no grid or table role selector',
    loadTimeScanSrc !== null &&
      (loadTimeScanSrc.includes('GRID_ARIA_SELECTOR') || loadTimeScanSrc.includes('role="grid"')),
    false);
  eq('nesting AC6: the added-node pass names no grid or table role selector',
    addedNodePassSrc !== null &&
      (addedNodePassSrc.includes('GRID_ARIA_SELECTOR') || addedNodePassSrc.includes('role="grid"')),
    false);
  // The step's page-wide entry point is nominateNests; findTables composes it
  // and keeps the 'selected' outcomes. Both scanners act on the other outcomes
  // too, so both call nominateNests directly.
  eq('nesting AC6: the load-time scan calls the nomination step',
    loadTimeScanSrc !== null && /nominateNests\s*\(/.test(loadTimeScanSrc), true);
  eq('nesting AC6: the added-node pass calls the nomination step',
    addedNodePassSrc !== null && /nominateNests\s*\(/.test(addedNodePassSrc), true);
})();

// --- AC7: the living docs and the test page state the rule ---

(function gridNesting_AC7_livingDocsAndTheTestPageStateTheRule() {
  const vocabularyMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'vocabulary.md'), 'utf8');
  const designMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'design.md'), 'utf8');
  const extensionReadme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  const testPage = fs.readFileSync(
    path.join(__dirname, '..', 'docs', 'test-pages', 'tables.html'), 'utf8');

  for (const term of ['qualifying element', 'chain root', 'containment chain', 'nesting depth']) {
    eq('nesting AC7: docs/vocabulary.md carries a row for "' + term + '"',
      new RegExp('^\\|\\s*' + term + '\\s*\\|', 'mi').test(vocabularyMd), true);
  }
  const pinnedPaneRow = vocabularyMd.split('\n')
    .find((line) => /^\|\s*pinned pane\s*\|/i.test(line)) || '';
  eq('nesting AC7: docs/vocabulary.md keeps a pinned pane row', pinnedPaneRow !== '', true);
  eq('nesting AC7: the pinned pane row states that the configured depth governs its columns',
    /depth/i.test(pinnedPaneRow), true);

  eq('nesting AC7: chrome-extension/README.md states the nesting depth',
    /nesting depth/i.test(extensionReadme), true);
  eq('nesting AC7: docs/design.md states the nesting depth',
    /nesting depth/i.test(designMd), true);

  const sectionStart = testPage.indexOf('13. Pinned-pane vendor grid');
  const nextHeadingAt = testPage.indexOf('<h2>', sectionStart);
  const section = sectionStart < 0 ? ''
    : testPage.slice(sectionStart, nextHeadingAt < 0 ? testPage.length : nextHeadingAt);
  const expectMatch = section.match(/<p class="expect">([\s\S]*?)<\/p>/);
  const expectText = expectMatch ? expectMatch[1] : '';
  eq('nesting AC7: the test page holds a pinned-pane vendor grid section', sectionStart >= 0, true);
  eq('nesting AC7: that section holds an expectation paragraph', expectText !== '', true);
  eq('nesting AC7: the expectation names the scrolling pane',
    /scrolling pane/i.test(expectText), true);
  eq('nesting AC7: the expectation states no pillbox on the wrapper',
    /pillbox[^.]*wrapper/i.test(expectText), false);
  eq('nesting AC7: the section states no second pillbox',
    /second pillbox/i.test(section), false);
})();

// --- The living docs state the field ---
//
// Two doc-pin blocks already stand in this suite (the nesting rule's and the
// data-test budget's); this one follows them. The vocabulary defines the term
// and the registry row lists it; the design doc's state-ownership paragraph
// lists it among the per-table registry fields.

(function shapeFingerprint_theLivingDocsStateTheField() {
  const vocabularyMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'vocabulary.md'), 'utf8');
  const designMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'design.md'), 'utf8');

  const fingerprintRow = vocabularyMd.split('\n')
    .find((line) => /^\|\s*shape fingerprint\s*\|/i.test(line)) || '';
  eq('fingerprint docs: docs/vocabulary.md carries a row for "shape fingerprint"',
    fingerprintRow !== '', true);
  eq('fingerprint docs: that row states the column count and the header row',
    /column count/i.test(fingerprintRow) && /header row/i.test(fingerprintRow), true);
  eq('fingerprint docs: that row states that the row count stays out',
    /row count/i.test(fingerprintRow), true);
  eq('fingerprint docs: that row states which grid has a header row',
    /(row group|groups its data rows|outside row)/i.test(fingerprintRow), true);
  eq('fingerprint docs: that row states which native table has one',
    /head section/i.test(fingerprintRow), true);
  eq('fingerprint docs: that row states what a table with no header row carries',
    /no header row/i.test(fingerprintRow), true);

  const registryRow = vocabularyMd.split('\n')
    .find((line) => /^\|\s*registry\s*\|/i.test(line)) || '';
  eq('fingerprint docs: the registry row lists the shape fingerprint among its details',
    /shape fingerprint/i.test(registryRow), true);

  const stateOwnership = designMd.split('\n')
    .find((line) => /The registry keys per-table storage on the live element/i.test(line)) || '';
  eq('fingerprint docs: docs/design.md keeps its per-table registry sentence',
    stateOwnership !== '', true);
  eq('fingerprint docs: that sentence lists the shape fingerprint',
    /shape fingerprint/i.test(stateOwnership), true);
  eq('fingerprint docs: that sentence states when the fingerprint carries header texts',
    /header row/i.test(stateOwnership), true);
})();

// --- Criterion 5: the living docs state the pending table rule ---

(function pendingRetest_AC5_livingDocsStateTheRule() {
  const vocabularyMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'vocabulary.md'), 'utf8');
  const designMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'design.md'), 'utf8');
  const extensionReadme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');

  const pendingRow = vocabularyMd.split('\n')
    .find((line) => /^\|\s*pending table\s*\|/i.test(line)) || '';
  eq('pending AC5: docs/vocabulary.md carries a row for "pending table"',
    pendingRow !== '', true);
  eq('pending AC5: the pending table row states the subtree observer',
    /subtree observer/i.test(pendingRow), true);
  eq('pending AC5: the pending table row states the re-test cap',
    /re-test cap/i.test(pendingRow), true);

  const designParagraphs = designMd.split('\n\n');
  const detectionParagraph = designParagraphs.find((p) => /^\*\*Detection\.\*\*/.test(p)) || '';
  eq('pending AC5: docs/design.md carries a Detection paragraph',
    detectionParagraph !== '', true);
  eq('pending AC5: the Detection paragraph states that an empty chain leaves a pending table',
    /pending table/i.test(detectionParagraph), true);
  eq('pending AC5: the Detection paragraph states the cap on failed re-tests',
    /reaches the cap/i.test(detectionParagraph), true);

  const stateParagraph = designParagraphs.find((p) => /hold state outside the model/i.test(p)) || '';
  eq('pending AC5: docs/design.md lists the state held outside the model',
    stateParagraph !== '', true);
  eq('pending AC5: that list names each pending table\'s subtree observer',
    /pending table[^.]*observer/i.test(stateParagraph), true);

  const detectionPoint = extensionReadme.split('\n')
    .find((line) => /Detection runs on demand/i.test(line)) || '';
  eq('pending AC5: chrome-extension/README.md carries the detection point',
    detectionPoint !== '', true);
  eq('pending AC5: the detection point states the pending table',
    /pending table/i.test(detectionPoint), true);
  eq('pending AC5: the detection point names the re-test cap in the detection settings',
    /pendingRetestCap/.test(detectionPoint), true);
})();

// =============================================================================
// Sprint merge-ladder: lib/dr-simplify classification ladder
// =============================================================================
//
// Before this sprint the classification ladder existed as two hand-kept-in-
// sync copies: the engine's per-cell loop in content.js (itself duplicated
// between the native-<table> path and computeGridRoundedValues, which
// documented itself as needing to match the native path "EXACTLY") and a much
// thinner copy in the sidebar preview-sample extractor (collectNumericCells /
// extractPreviewSamples) that skipped most of the rules outright. All three
// now call classifyCell (lib/dr-simplify/ladder.js).
//
// This section has three parts:
//   1. Package discipline — mirrors the DR_NUMBER/DR_TABLE checks.
//   2. classifyCell unit tests — one per ladder rule, exercised directly with
//      plain data (no DOM), matching the file's PURE contract.
//   3. Divergence tests — the preview extractor used to skip almost every
//      rule below; each test pins the MERGED (engine-wins) behavior and
//      documents what the old preview copy did instead.

// --- 1. Package discipline ---

(function drSimplifyBundleMatchesSourceDeclarations() {
  const FUNCTION_DECL_RE = /^function\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
  const declaredNames = ladderCode === null ? [] :
    [...ladderCode.matchAll(FUNCTION_DECL_RE)].map((m) => m[1]).sort();
  eq('lib/dr-simplify/ladder.js: source present in manifest', ladderCode !== null, true);
  eq('lib/dr-simplify bundle: ladder.js declared at least one top-level function',
    declaredNames.length > 0, true);
  eq('lib/dr-simplify/index.js: DR_SIMPLIFY exists on the global scope after the main eval',
    typeof globalThis.DR_SIMPLIFY, 'object');
  eq('lib/dr-simplify bundle: DR_SIMPLIFY keys are exactly the top-level functions declared in ladder.js',
    Object.keys(globalThis.DR_SIMPLIFY || {}).sort(), declaredNames);
  eq('lib/dr-simplify bundle: every DR_SIMPLIFY entry is itself a function',
    declaredNames.every((n) => typeof (globalThis.DR_SIMPLIFY || {})[n] === 'function'), true);
})();

(function drSimplifyIndexJsDeclaresExactlyOneGlobal() {
  const indexSrc = sourceByName('lib/dr-simplify/index.js');
  if (indexSrc === null) {
    eq('lib/dr-simplify/index.js: source present in manifest', false, true);
    return;
  }
  const topLevelDeclarations = indexSrc.match(/^(const|let|var|function\b|class\b)/gm) || [];
  eq('lib/dr-simplify/index.js: exactly one top-level declaration in the file',
    topLevelDeclarations.length, 1);
  eq('lib/dr-simplify/index.js: the sole top-level declaration is DR_SIMPLIFY',
    /^const DR_SIMPLIFY\b/m.test(indexSrc), true);
})();

// ---------------------------------------------------------------------------
// Sprint engine-returns-results: static purity scan.
// The simplification engine (roundTable, the one simplification pass —
// simplifyTableCells, classifyTableCell, cellPatches — and
// reapplyRounding) must never call chrome.* directly — it returns result
// values instead, and the controller sends the messages. Mirrors the
// detectionFunctions_sourceScan_noPageWrites pattern above.
// ---------------------------------------------------------------------------
(function engineFunctions_sourceScan_noChromeCalls() {
  const contentSrc = sourceByName('content.js');
  if (contentSrc === null) {
    eq('engine purity scan: source file content.js present in manifest', false, true);
    return;
  }
  const ENGINE_FNS = ['roundTable', 'simplifyTableCells', 'classifyTableCell', 'cellPatches', 'reapplyRounding'];

  // Extract a top-level `function name(` body by brace-matching from the
  // opening brace to its balanced close (same approach as the detection
  // purity scan above).
  function extractFunctionBody(src, fnName) {
    const sig = new RegExp(`function ${fnName}\\s*\\(`);
    const m = sig.exec(src);
    if (!m) return null;
    const braceStart = src.indexOf('{', m.index);
    if (braceStart === -1) return null;
    let depth = 0;
    for (let i = braceStart; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) return src.slice(braceStart, i + 1);
      }
    }
    return null;
  }

  for (const fnName of ENGINE_FNS) {
    const body = extractFunctionBody(contentSrc, fnName);
    eq(`engine purity scan: ${fnName} body located in content.js`, body !== null, true);
    if (body === null) continue;
    eq(`engine purity scan: ${fnName} does not reference "chrome."`,
      body.includes('chrome.'), false);
  }
})();

// ---------------------------------------------------------------------------
// Sprint engine-returns-results: pin the exact state:rangeOk/state:rangeError message
// sequence for one full apply (applySidebarRounding -> roundTable ->
// sendRangeStatusMessage -> chrome.runtime.sendMessage).
//
// The flow used to start at a plain-toggle helper, which the 2026-09-14
// sidebar-state-removal design retired (#241). The apply is the one path to
// roundTable now, so it drives the flow here. It leads with its own state:applyOk,
// which the retired helper never sent; the state:rangeOk/state:rangeError and
// intent:updateMenuLabel tail is byte-identical to the frozen capture.
//
// Before this sprint, roundTable sent state:rangeError/state:rangeOk itself. Now the
// engine returns { applied, rangeStatus, error } and the controller sends the
// message. The two expected sequences below (one per range-validity branch)
// were verified byte-for-byte against content.js as it stood at commit
// 4340bd1 (the refactor/merge-ladder tip this sprint branched from) by
// running that commit's real content.js through this same vm harness and
// diffing the captured chrome.runtime.sendMessage sequence against the one
// captured here. They were identical. This test pins that verified sequence
// so a future change cannot silently drop or duplicate a message.
// ---------------------------------------------------------------------------
(function engineReturnsResults_rangeStatusMessageSequence() {
  const contentSrc = sourceByName('content.js');
  if (contentSrc === null) {
    eq('range-status sequence: source file content.js present in manifest', false, true);
    return;
  }

  // Isolated vm context per run so module-level state (DR_DEFAULTS mutation,
  // highlightStyleInjected, tableOptions) never bleeds between the two
  // scenarios below.
  function runFullToggleFlow(rangeExprOverride) {
    const sentMessages = [];
    const sandbox = {
      document: {
        addEventListener() {},
        querySelectorAll() { return []; },
        readyState: 'complete',
        body: { appendChild() {} },
        createElement() { return { textContent: '' }; },
        head: { appendChild() {} },
        createTreeWalker(cell) {
          let done = false;
          return {
            nextNode() {
              if (done) return null;
              done = true;
              return {
                get nodeValue() { return this._val !== undefined ? this._val : cell.innerText; },
                set nodeValue(v) { cell.innerText = v; cell.textContent = v; this._val = v; },
              };
            },
          };
        },
      },
      window: {
        addEventListener() {},
        getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
      },
      NodeFilter: { SHOW_TEXT: 4 },
      Node: { ELEMENT_NODE: 1 },
      MutationObserver: class { observe() {} disconnect() {} },
      ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
      chrome: {
        runtime: {
          sendMessage(msg) { sentMessages.push(msg); },
          onMessage: { addListener() {} },
          lastError: null,
        },
      },
    };
    const vm = require('vm');
    const ctx = vm.createContext(sandbox);
    const bundle = contentScriptFiles
      .map((file) => (file === 'content.js' ? contentSrc : contentScriptSources.get(file)))
      .join('\n');
    vm.runInContext(
      bundle + '\nthis.__applySidebarRounding = applySidebarRounding; this.__DR_DEFAULTS = DR_DEFAULTS;',
      ctx
    );

    // 2x2 so the target cell (row 1, col 1) sits outside DR_DEFAULTS's
    // simplifyFirstRow/simplifyFirstColumn: false exclusion — DR_DEFAULTS
    // (unlike the no-chrome e2e fixture above) is used as-is here, matching
    // the settings record a press carries into the apply.
    const table = makeMockTable([
      [{ tag: 'td', text: 'label' }, { tag: 'td', text: 'header' }],
      [{ tag: 'td', text: 'label' }, { tag: 'td', text: '1,234,567' }],
    ]);
    // The apply ends with flashRangePulse, which flashes the whole-table
    // outline via table.classList — a real <table> element has this; the bare
    // mock from makeMockTable does not. It also opens with a reset and closes
    // by checking for a simplified cell, both through the marker-class
    // selector, so the mock needs a live scan rather than a fixed answer — an
    // empty list would hide the closing intent:updateMenuLabel.
    table.classList = { add() {}, remove() {} };
    table.querySelectorAll = (sel) => {
      if (sel !== '.dr-ext-rounded') return [];
      const found = [];
      for (const row of table.rows) {
        for (const cell of row.cells) {
          if (cell.classList && cell.classList.contains('dr-ext-rounded')) found.push(cell);
        }
      }
      return found;
    };
    table.querySelector = (sel) => table.querySelectorAll(sel)[0] || null;
    if (rangeExprOverride !== undefined) {
      sandbox.__DR_DEFAULTS.rangeExpr = rangeExprOverride;
    }
    let threw = null;
    try {
      sandbox.__applySidebarRounding(table, sandbox.__DR_DEFAULTS);
    } catch (e) {
      threw = e.message;
    }
    return { sentMessages, threw, table };
  }

  // --- Scenario 1: valid range (default rangeExpr === '') -> rounds, state:rangeOk ---
  const okRun = runFullToggleFlow(undefined);
  eq('range-status sequence (valid range): the apply does not throw',
    okRun.threw, null);
  eq('range-status sequence (valid range): exact message sequence matches parent-branch capture, behind the apply\'s own state:applyOk',
    okRun.sentMessages,
    [
      { action: 'state:applyOk' },
      { action: 'state:rangeOk' },
      { action: 'intent:updateMenuLabel', title: 'Toggle table' },
    ]);
  eq('range-status sequence (valid range): the cell was actually rounded',
    okRun.table.rows[1].cells[1].classList.contains('dr-ext-rounded'), true);

  // --- Scenario 2: invalid range ("1a" matches neither a column letter nor a
  // row number pattern) -> no rounding, state:rangeError with the parse error ---
  const errorRun = runFullToggleFlow('1a');
  eq('range-status sequence (invalid range): the apply does not throw',
    errorRun.threw, null);
  eq('range-status sequence (invalid range): exact message sequence matches parent-branch capture, behind the apply\'s own state:applyOk',
    errorRun.sentMessages,
    [
      { action: 'state:applyOk' },
      { action: 'state:rangeError', error: 'Invalid range: "1a"' },
    ]);
  eq('range-status sequence (invalid range): the cell was NOT rounded',
    errorRun.table.rows[1].cells[1].classList.contains('dr-ext-rounded'), false);
})();

// ---------------------------------------------------------------------------
// Sprint toggle-split: ui-toggle.js splits into drawing (render from state,
// hold only view-transient state) and publishing (intents on DR_BUS in place
// of calls into the controller). The click handler used to call the
// controller's plain-toggle helper straight from the view.
//
// The forbidden list named that helper and the form-flip helper it reached
// until the 2026-09-14 sidebar-state-removal design retired both (#241). A
// list of names that exist nowhere cannot fail, so the list now names the
// controller entry points that DO exist: a view calling any of these reaches
// past the intent and around the one press path.
// ---------------------------------------------------------------------------
(function toggleSplit_viewCallsNoControllerFunctionDirectly() {
  const uiToggleSrc = sourceByName('ui-toggle.js');
  if (uiToggleSrc === null) {
    eq('toggle-split: ui-toggle.js is present in the manifest', false, true);
    return;
  }
  const FORBIDDEN_CONTROLLER_CALLS = ['applySidebarRounding', 'resetTable', 'roundTable'];
  // Sanity check on the scan itself: every forbidden name is a real function
  // in the content-script stack, so the filter below tests something.
  const missingFromController = FORBIDDEN_CONTROLLER_CALLS.filter(
    (name) => !new RegExp('function\\s+' + name + '\\s*\\(').test(allContentSrc));
  eq('toggle-split: every forbidden name is a real controller function (sanity check on the scan itself)',
    missingFromController, []);

  const foundCalls = FORBIDDEN_CONTROLLER_CALLS.filter((name) => {
    const callRe = new RegExp('\\b' + name + '\\s*\\(');
    return callRe.test(uiToggleSrc);
  });
  eq('toggle-split: ui-toggle.js calls no controller function directly',
    foundCalls, []);

  // The click handler publishes the press as an intent instead.
  eq('toggle-split: ui-toggle.js publishes intent:toggleTable from the click handler',
    /DR_BUS\.publish\(\s*'intent:toggleTable'/.test(uiToggleSrc), true);
})();

// ---------------------------------------------------------------------------
// Issue #262 (static): the locked presentation exists in the stylesheets.
// body.table-locked must dim and mute the settings area and the title-row
// switch in sidebar.html; the on-page pill's locked look lives in
// ui-toggle.js's injected style.
// ---------------------------------------------------------------------------
(function lockedPresentation_stylesExist() {
  const sidebarHtmlSrc = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  eq('locked styles: sidebar.html styles body.table-locked',
    sidebarHtmlSrc.includes('body.table-locked'), true);
  eq('locked styles: the locked sidebar blocks pointer input (pointer-events: none present in the table-locked block)',
    /body\.table-locked[^}]*\{[^}]*pointer-events:\s*none/.test(sidebarHtmlSrc), true);
  eq('locked styles: ui-toggle.js styles the locked pill class',
    uiToggleCode !== null && uiToggleCode.includes('.dr-ext-morph-locked'), true);
  eq('locked styles: the locked pill shows a not-allowed cursor',
    uiToggleCode !== null && /\.dr-ext-morph-locked[^}]*\{[^}]*cursor:\s*not-allowed/.test(uiToggleCode), true);
})();

// --- (c) Static lock: no production read of the dr-ext-grid marker class as
// state — classList.contains/closest('.dr-ext-grid') may appear only as a
// write (classList.add) or inside a comment discussing the history; a real
// read call is what this locks out. ---
(function registrySprint_noMarkerClassReadLock() {
  const filesToScan = ['content.js', 'ui-toggle.js', 'lib/dr-table/detect.js'];
  const readPatterns = [
    /classList\.contains\(\s*['"]dr-ext-grid['"]\s*\)/g,
    /\.closest\(\s*['"]\.dr-ext-grid['"]\s*\)/g,
  ];
  for (const file of filesToScan) {
    const src = sourceByName(file);
    if (src === null) {
      eq(`registry static lock: ${file} present in manifest`, false, true);
      continue;
    }
    // Strip line comments and block comments before scanning, so a comment
    // that merely mentions the old pattern (documenting the sprint's own
    // removal of it) cannot trip the lock.
    const withoutComments = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');
    const matches = readPatterns.flatMap((re) => withoutComments.match(re) || []);
    eq(`registry static lock: ${file} has no dr-ext-grid marker-class read`,
      matches, []);
  }
})();

// --- (d) The shared-ownership guard comment is gone from content.js — the
// flag it warned about no longer has two independent writers to coordinate. ---
(function registrySprint_guardCommentRemoved() {
  const contentSrc = sourceByName('content.js');
  eq('registry: the old showing-original shared-ownership guard comment is gone',
    /Showing-original guard: when the per-table toggle has flipped the grid/.test(contentSrc),
    false);
})();

// --- sidebar: the screenshot take never blocks the save ---
//
// takeCaptureScreenshot takes its tabs interface as a parameter and answers
// through one callback, so the suite drives the real source with a stub
// that settles at once. Every route — a resolved take, a rejected one, a
// throw before the promise exists, a tabs interface with no capture — calls
// the callback exactly once, with the image or with a not-taken record that
// holds the reason.
(function captureScreenshotTake() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const source = sidebarSrc.match(/function takeCaptureScreenshot\([\s\S]*?\n\}/);
  eq('capture-shot: takeCaptureScreenshot extracted from sidebar.js', !!source, true);
  if (!source) return;
  const warned = [];
  const logStub = { warn: (text) => { warned.push(text); }, debug: () => {} };
  // The quality constant sits beside the take in the source; the take reads
  // it as a bare name, so the extracted function receives it the same way.
  const quality = sidebarSrc.match(/const CAPTURE_SCREENSHOT_QUALITY = (\d+);/);
  eq('capture-shot: the quality constant sits beside the take', !!quality, true);
  const take = (new Function('DR_LOG', 'CAPTURE_SCREENSHOT_QUALITY', 'return ' + source[0] + ';'))(
    logStub, quality ? Number(quality[1]) : 0);

  const drive = (tabsApi, windowId) => {
    const results = [];
    take(tabsApi, windowId, (result) => { results.push(result); });
    return results;
  };
  const settled = (value) => ({ then(ok) { ok(value); } });
  const rejected = (error) => ({ then(ok, fail) { fail(error); } });

  const okArgs = [];
  const ok = drive({ captureVisibleTab: (...args) => { okArgs.push(args); return settled('data:image/jpeg;base64,AAAA'); } }, 7);
  eq('capture-shot: a resolved take yields the data URL and a taken record with its char count',
    ok, [{ dataUrl: 'data:image/jpeg;base64,AAAA',
      record: { taken: true, format: 'jpeg', chars: 'data:image/jpeg;base64,AAAA'.length } }]);
  eq('capture-shot: the take passes jpeg at quality 85 and the window it was given',
    okArgs, [[7, { format: 'jpeg', quality: 85 }]]);

  const noWindowArgs = [];
  drive({ captureVisibleTab: (...args) => { noWindowArgs.push(args); return settled('data:image/jpeg;base64,AAAA'); } }, null);
  eq('capture-shot: with no window the take omits the window argument',
    noWindowArgs, [[{ format: 'jpeg', quality: 85 }]]);

  const failed = drive({ captureVisibleTab: () => rejected(new Error('activeTab missing')) }, 7);
  eq('capture-shot: a rejected take yields a not-taken record with the reason and no data URL',
    failed, [{ dataUrl: null, record: { taken: false, reason: 'activeTab missing' } }]);
  eq('capture-shot: a rejected take logs a warn row',
    warned.length === 1 && /screenshot failed \(activeTab missing\)/.test(warned[0]), true);

  const threw = drive({ captureVisibleTab: () => { throw new Error('no permission'); } }, 7);
  eq('capture-shot: a take that throws before returning yields a not-taken record',
    threw, [{ dataUrl: null, record: { taken: false, reason: 'no permission' } }]);

  const missing = drive({}, 7);
  eq('capture-shot: a missing capture function yields a not-taken record',
    missing.length === 1 && missing[0].dataUrl === null && missing[0].record.taken === false &&
      typeof missing[0].record.reason === 'string' && missing[0].record.reason.length > 0, true);

  const empty = drive({ captureVisibleTab: () => settled('') }, 7);
  eq('capture-shot: a take that answers with no image yields a not-taken record',
    empty.length === 1 && empty[0].dataUrl === null && empty[0].record.taken === false, true);
})();

// Criterion 4: the living docs name the detection settings in the capture
// paragraph or row a reader would consult — the README's capture section,
// the design doc's Capture paragraph, and the vocabulary's capture state
// row — loose enough to survive rewording, tight enough to fail if the
// mention is dropped.
(function captureDetectionSettingsLivingDocsNameTheTerm() {
  const readmeMd = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  const designMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'design.md'), 'utf8');
  const vocabularyMd = fs.readFileSync(path.join(__dirname, '..', 'docs', 'vocabulary.md'), 'utf8');

  const readmeCaptureSection = (readmeMd.split('\n## Capture\n')[1] || '').split('\n## ')[0];
  eq('living docs: chrome-extension/README.md\'s capture paragraph names the detection settings',
    readmeCaptureSection.includes('detection settings'), true);

  const designCaptureParagraph = designMd.split('\n').find((line) => line.startsWith('**Capture.**')) || '';
  eq('living docs: docs/design.md\'s Capture paragraph names the detection settings',
    designCaptureParagraph.includes('detection settings'), true);

  const vocabularyCaptureStateRow = vocabularyMd.split('\n').find((line) => line.startsWith('| capture state |')) || '';
  eq('living docs: docs/vocabulary.md\'s capture state row names the detection settings',
    vocabularyCaptureStateRow.includes('detection settings'), true);
})();

// --- content.js: the extension stands down on capture pages ---
//
// A saved capture holds a real table; opened with file access enabled, the
// content script runs on it like on any page. The renderer stamps
// data-dr-capture on the document element, and the controller gates its two
// entry points on that marker — the contextmenu handler (selection and the
// menu path) and the load-time scan with its added-node observer (pillboxes
// and registration). With neither, no table on a capture page is ever
// selected, registered, or rounded. Source-text assertions, matching the
// suite's style for load-time wiring the harness cannot re-run.

(function captureMarkerStandDown() {
  const src = sourceByName('content.js') || '';
  eq('capture-marker: the controller reads the capture marker once',
    /const IS_CAPTURE_PAGE = [\s\S]{0,220}drCapture/.test(src), true);
  eq('capture-marker: the contextmenu handler stands down on a capture page',
    /contextmenu[\s\S]{0,120}if \(IS_CAPTURE_PAGE\) return;/.test(src), true);
  eq('capture-marker: the load-time scan and observer stand down on a capture page',
    /typeof MutationObserver !== 'undefined' && !IS_CAPTURE_PAGE/.test(src), true);
})();

// --- lib/dr-log: the log buffer ---
//
// DR_LOG holds the last 50 rows the extension records, one instance per
// context (content script and sidebar each evaluate the file separately).
// Every capture carries a snapshot of this buffer, so these tests pin the
// row shape, the cap, the drop counter, the console forwarding, and the
// snapshot's copy semantics. The buffer is a singleton shared with every
// other test in this file, so all assertions here are relative (last row,
// before/after counts) — and the cap test runs last because it fills it.

(function drLogBuffer() {
  eq('dr-log: DR_LOG loads in the content-script bundle',
    typeof globalThis.DR_LOG, 'object');
  eq('dr-log: manifest loads lib/dr-log/index.js directly after constants.js',
    contentScriptFiles[1], 'lib/dr-log/index.js');
  const sidebarHtml = fs.readFileSync(path.join(__dirname, 'sidebar.html'), 'utf8');
  eq('dr-log: sidebar.html loads lib/dr-log/index.js before sidebar.js',
    sidebarHtml.indexOf('lib/dr-log/index.js') !== -1 &&
      sidebarHtml.indexOf('lib/dr-log/index.js') < sidebarHtml.indexOf('sidebar.js'),
    true);
  if (typeof globalThis.DR_LOG !== 'object') return;
  const LOG = globalThis.DR_LOG;

  LOG.debug('row shape probe');
  let snap = LOG.snapshot();
  const last = snap.entries[snap.entries.length - 1];
  eq('dr-log: a row holds its level and text',
    { level: last.level, text: last.text },
    { level: 'debug', text: 'row shape probe' });
  eq('dr-log: a row\'s timestamp parses as a date',
    isNaN(Date.parse(last.at)), false);
  eq('dr-log: the snapshot reports the row cap', snap.limit, 50);

  // console.info and console.error are not muted by the harness (only debug
  // and warn are); spy them for the duration of these three calls so the
  // forwarded rows stay out of the test report.
  const origInfo = console.info;
  const origError = console.error;
  console.info = () => {};
  console.error = () => {};
  LOG.info('info probe');
  LOG.warn('warn probe');
  LOG.error('error probe');
  console.info = origInfo;
  console.error = origError;
  eq('dr-log: info, warn, and error rows carry their level',
    LOG.snapshot().entries.slice(-3).map((e) => e.level),
    ['info', 'warn', 'error']);

  LOG.debug(42);
  eq('dr-log: non-string text is stored as a string',
    LOG.snapshot().entries.slice(-1)[0].text, '42');

  // Forwarding: a row still reaches the console (devtools behavior is
  // unchanged). The harness mutes console.debug/console.warn globally; this
  // test installs its own spy and puts the mute back.
  const origDebug = console.debug;
  let forwarded = null;
  console.debug = (msg) => { forwarded = msg; };
  LOG.debug('forwarding probe');
  console.debug = origDebug;
  eq('dr-log: a row forwards to the console', forwarded, 'forwarding probe');

  const snapA = LOG.snapshot();
  snapA.entries[snapA.entries.length - 1].text = 'mutated';
  eq('dr-log: snapshot rows are copies, so mutating one never reaches the buffer',
    LOG.snapshot().entries.slice(-1)[0].text, 'forwarding probe');

  LOG.debug('x'.repeat(3000));
  eq('dr-log: a long row is cut at 2000 characters',
    LOG.snapshot().entries.slice(-1)[0].text.length, 2000);

  // The 50-row cap and the drop counter — last in this section because it
  // fills the shared buffer.
  const droppedBefore = LOG.snapshot().dropped;
  for (let i = 0; i < 55; i++) LOG.debug('cap probe ' + i);
  snap = LOG.snapshot();
  eq('dr-log: the buffer holds at most 50 rows', snap.entries.length, 50);
  eq('dr-log: rows dropped past the cap are counted',
    snap.dropped >= droppedBefore + 5, true);
  eq('dr-log: the newest row survives the cap',
    snap.entries[snap.entries.length - 1].text, 'cap probe 54');
})();

// --- lib/dr-log: the stack trace and the row listener ---
//
// A warn or error row carries the stack trace at the moment it was recorded,
// the same trace the extension error page shows, so a capture holds it and
// the application model can store it. Debug and info rows carry none: they
// are frequent, and a trace costs a stack walk per row. The row listener is
// how the controller learns that a row landed without the log module reaching
// up to the application model or the bus, both of which load after it.

(function drLogStackTraceAndListener() {
  if (typeof globalThis.DR_LOG !== 'object') return;
  const LOG = globalThis.DR_LOG;
  const origError = console.error;
  console.error = () => {};
  try {
    function stackProbeCaller() { LOG.warn('stack probe'); }
    stackProbeCaller();
    const warnRow = LOG.snapshot().entries.slice(-1)[0];
    eq('dr-log: a warn row carries the stack trace that recorded it',
      typeof warnRow.stack === 'string' && /stackProbeCaller/.test(warnRow.stack), true);
    eq('dr-log: the stack trace starts at the caller, with the log module\'s own frames left out',
      /stackProbeCaller/.test(String(warnRow.stack).split('\n')[0]), true);

    function errorStackProbeCaller() { LOG.error('error stack probe'); }
    errorStackProbeCaller();
    eq('dr-log: an error row carries the stack trace',
      /errorStackProbeCaller/.test(LOG.snapshot().entries.slice(-1)[0].stack || ''), true);

    LOG.debug('no stack probe');
    eq('dr-log: a debug row carries no stack trace',
      LOG.snapshot().entries.slice(-1)[0].stack, null);
    LOG.info('no stack probe');
    eq('dr-log: an info row carries no stack trace',
      LOG.snapshot().entries.slice(-1)[0].stack, null);

    // One list: the levels that carry a trace are the levels the controller
    // records as extension errors, read from here and held nowhere else.
    eq('dr-log: the error levels are warn and error', LOG.ERROR_LEVELS, ['warn', 'error']);
    eq('dr-log: the controller reads the error levels from the log module',
      /DR_LOG\.ERROR_LEVELS/.test(sourceByName('content.js') || '') &&
        !/ERROR_ROW_LEVELS/.test(sourceByName('content.js') || ''), true);

    // A deep stack trace is cut at the same bound as row text.
    const savedLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = 200;
    function deepWarn(n) { if (n === 0) { LOG.warn('deep probe'); return; } deepWarn(n - 1); }
    deepWarn(150);
    Error.stackTraceLimit = savedLimit;
    eq('dr-log: a long stack trace is cut at 2000 characters',
      String(LOG.snapshot().entries.slice(-1)[0].stack).length, 2000);

    const snapCopy = LOG.snapshot();
    snapCopy.entries[snapCopy.entries.length - 1].stack = 'mutated';
    eq('dr-log: a snapshot row\'s stack trace is a copy',
      LOG.snapshot().entries.slice(-1)[0].stack === 'mutated', false);

    const seen = [];
    const off = LOG.onRow((row) => { seen.push(row); });
    LOG.debug('listener probe');
    eq('dr-log: a row listener receives each row as it lands',
      seen.length === 1 && seen[0].text === 'listener probe' && seen[0].level === 'debug', true);
    seen[0].text = 'mutated';
    eq('dr-log: the listener receives a copy, so mutating it never reaches the buffer',
      LOG.snapshot().entries.slice(-1)[0].text, 'listener probe');
    off();
    LOG.debug('after removal probe');
    eq('dr-log: a removed row listener receives nothing more', seen.length, 1);

    let reported = null;
    console.error = (msg) => { reported = msg; };
    const offThrowing = LOG.onRow(() => { throw new Error('listener failure'); });
    LOG.debug('throwing listener probe');
    offThrowing();
    eq('dr-log: a listener that throws does not stop the row from recording',
      LOG.snapshot().entries.slice(-1)[0].text, 'throwing listener probe');
    eq('dr-log: a listener\'s failure is reported on the console',
      typeof reported === 'string' && /listener failure/.test(reported), true);
  } finally {
    console.error = origError;
  }
})();

// --- toast view: an error row shows on the page ---
//
// The toast view subscribes to the model's error state change and draws the
// newest row's text in one fixed element at the page's bottom right, removed
// by a click or after the hide delay. A second row replaces the text and
// restarts the delay, so a repeating warning shows one toast. The view never
// logs: a row it recorded would publish back to it.
//
// The live view has drawn against earlier tests' page stubs by the time this
// section runs, so these build the settings contract, the bus, the model,
// and the view together in a fresh context with their own page stub. The
// model's publish reaching the view's subscription is the wiring under test.

(function toastViewShowsErrorRows() {
  const uiToastCode = sourceByName('ui-toast.js');
  eq('toast: ui-toast.js is a content script in the manifest', uiToastCode !== null, true);
  if (uiToastCode === null) return;

  const appended = [];
  const timers = [];
  let cleared = 0;
  const makeEl = (tag) => {
    const listeners = {};
    const attrs = {};
    return {
      _tag: tag, className: '', textContent: '', parentNode: null, _listeners: listeners,
      setAttribute(name, value) { attrs[name] = value; },
      getAttribute(name) { return attrs[name] === undefined ? null : attrs[name]; },
      addEventListener(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
    };
  };
  const container = () => ({
    appendChild(child) { appended.push(child); child.parentNode = this; return child; },
    removeChild(child) {
      const i = appended.indexOf(child);
      if (i >= 0) appended.splice(i, 1);
      child.parentNode = null;
    },
  });
  const vm = require('vm');
  const sandbox = {
    chrome: global.chrome,
    console,
    document: { createElement: makeEl, body: container(), head: container() },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => { cleared++; },
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(constantsCode + '\n' + messagingCode + '\n' + storeCode + '\n' + uiToastCode +
    '\nthis.__store = DR_STORE; this.__toast = DR_TOAST;', ctx);
  const store = sandbox.__store;
  const view = sandbox.__toast;
  const isToast = (el) => el.className === view.TOAST_CLASS;

  store.recordError({ at: 'x', level: 'warn', text: 'Dynamic Rounding: toast probe one', stack: null });
  const toast = appended.find(isToast);
  eq('toast: an error row appends one toast to the page', !!toast, true);
  eq('toast: the toast shows the row\'s text',
    toast ? toast.textContent : null, 'Dynamic Rounding: toast probe one');
  eq('toast: the toast is a status region for assistive technology',
    toast ? toast.getAttribute('role') : null, 'status');
  eq('toast: the view injects its stylesheet once',
    appended.filter((el) => el._tag === 'style' && el.textContent.includes(view.TOAST_CLASS)).length, 1);
  eq('toast: the toast hides itself after the hide delay',
    timers.length === 1 && timers[0].ms === view.TOAST_HIDE_MS, true);

  store.recordError({ at: 'x', level: 'warn', text: 'toast probe two', stack: null });
  eq('toast: a second row replaces the text of the one toast',
    { count: appended.filter(isToast).length, text: toast ? toast.textContent : null },
    { count: 1, text: 'toast probe two' });
  eq('toast: a second row restarts the hide delay',
    { cleared, timers: timers.length }, { cleared: 1, timers: 2 });

  if (timers[1]) timers[1].fn();
  eq('toast: the hide delay removes the toast', appended.some(isToast), false);

  store.recordError({ at: 'x', level: 'error', text: 'toast probe three', stack: null });
  const second = appended.find(isToast);
  eq('toast: a row after the hide draws a fresh toast',
    !!second && second !== toast && second.textContent === 'toast probe three', true);
  if (second) second._listeners.click[0]();
  eq('toast: a click removes the toast', appended.some(isToast), false);
  eq('toast: the stylesheet is injected once for the page\'s life',
    appended.filter((el) => el._tag === 'style').length, 1);
  eq('toast: the view logs nothing', /DR_LOG\./.test(uiToastCode), false);
})();

// --- lib/dr-log: call sites route through the buffer ---
//
// The extension's own console.debug call sites (two in content.js, one in
// detect.js) route through DR_LOG so their rows land in the capture. A
// direct console.debug row is invisible to the capture, so none may remain
// in the content scripts. detect.js is also evaluated standalone in vm
// sandboxes elsewhere in this suite, so its call site guards on DR_LOG's
// presence instead of assuming the load order.

(function drLogCallSites() {
  eq('dr-log: content.js keeps no direct console.debug call',
    /console\.debug\(/.test(sourceByName('content.js') || ''), false);
  eq('dr-log: detect.js keeps no direct console.debug call',
    /console\.debug\(/.test(detectCode || ''), false);
  eq('dr-log: registration logs a row (ui-toggle.js)',
    /DR_LOG\.debug\([^)]*egistered/.test(uiToggleCode || ''), true);
  eq('dr-log: a blocked apply logs a warn row (content.js)',
    /DR_LOG\.warn\([^)]*locked/.test(sourceByName('content.js') || ''), true);
  eq('dr-log: a table turning locked logs a warn row (ui-toggle.js)',
    /DR_LOG\.warn\([^)]*ocked/.test(uiToggleCode || ''), true);
})();

// --- #325 Task 8: the service worker runs on the bus ---
(function workerRunsOnBus() {
  const bgSrc = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');
  eq('worker on bus: importScripts loads the messaging adapter',
    /importScripts\([^)]*adapters\/messaging\.js/.test(bgSrc), true);
  eq('worker on bus: no chrome.runtime.onMessage listener of its own',
    bgSrc.includes('chrome.runtime.onMessage.addListener'), false);
  eq('worker on bus: no raw chrome.tabs.sendMessage call',
    bgSrc.includes('chrome.tabs.sendMessage'), false);
  eq('worker on bus: the menu click publishes with an explicit tab number',
    /DR_BUS\.publish\(\s*'intent:menuClicked',\s*\{\},\s*\{\s*tabId:/.test(bgSrc), true);
  eq('worker on bus: the page-unload subscriber reads the sending tab from meta',
    /subscribe\(\s*'state:pageUnloaded',\s*\([^)]*meta[^)]*\)/.test(bgSrc), true);
  eq('worker on bus: the duplicate on/off re-send is gone',
    bgSrc.includes('tableEnabledChanged'), false);
})();

// --- #325 Task 9: the content script publishes through the bus ---
(function contentPublishesThroughBus() {
  const contentSrc = sourceByName('content.js');
  eq('content on bus: no raw chrome.runtime.sendMessage call',
    contentSrc.includes('chrome.runtime.sendMessage'), false);
  for (const topic of ['state:tableActivated', 'state:tableSwitched',
      'state:tableEnabledChanged', 'state:rangeError', 'state:rangeOk',
      'state:applyBlocked', 'state:applyOk', 'state:previewSamplesChanged',
      'state:pageUnloaded', 'intent:updateMenuLabel']) {
    eq('content on bus: publishes ' + topic,
      contentSrc.includes("publish('" + topic + "'"), true);
  }
  eq('content on bus: the menu click arrives as a subscription',
    /DR_BUS\.subscribe\(\s*'intent:menuClicked'/.test(contentSrc), true);
  eq('content on bus: the sidebar-opened report arrives as a subscription',
    /DR_BUS\.subscribe\(\s*'state:sidebarOpened'/.test(contentSrc), true);
  eq('content on bus: the one delivery of the on/off report is this publish',
    contentSrc.split("publish('state:tableEnabledChanged'").length - 1, 1);
})();

// --- #325 Task 10: the sidebar subscribes instead of listening ---
(function sidebarSubscribesThroughBus() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  eq('sidebar on bus: no chrome.runtime.onMessage listener of its own',
    sidebarSrc.includes('chrome.runtime.onMessage.addListener'), false);
  for (const topic of ['state:tableActivated', 'intent:closeSidebar', 'state:rangeError',
      'state:rangeOk', 'state:applyBlocked', 'state:applyOk',
      'state:previewSamplesChanged', 'state:tableSwitched', 'state:tableEnabledChanged']) {
    eq('sidebar on bus: subscribes to ' + topic,
      sidebarSrc.includes("subscribe('" + topic + "'"), true);
  }
  eq('sidebar on bus: the unload report publishes through the bus',
    /DR_BUS\.publish\(\s*'state:sidebarClosed'/.test(sidebarSrc), true);
})();

// --- The sidebar's one-tab rule, driven end to end (issue #343) -------------
//
// The section above drives the unit directly, so it passes whether or not the
// sidebar ever calls it. This one evaluates the whole sidebar against stubs,
// captures the message listener and the activation listener it registers, and
// drives a report and a tab switch through the real path.
(function boundTabWiringSection() {
  const roundingSrc = sourceByName('lib/dr-number/rounding.js');
  const coreSrc = sourceByName('lib/dr-number/core.js');
  if (constantsCode === null || roundingSrc === null || coreSrc === null || messagingCode === null) {
    eq('bound tab wiring: source files present in manifest', false, true);
    return;
  }

  const BOUND_TAB = 21;
  const OTHER_TAB = 22;
  const BOUND_WINDOW = 5;

  function makeEl() {
    return {
      addEventListener() {}, removeEventListener() {},
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      style: {}, value: '', checked: false, disabled: false, textContent: '', innerHTML: '',
      appendChild() {}, querySelector() { return makeEl(); }, querySelectorAll() { return []; },
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
      matches() { return false; }, closest() { return null; }, dataset: {},
      setAttribute() {}, removeAttribute() {},
    };
  }

  const statusEl = makeEl();
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
    getElementById(id) { return id === 'status' ? statusEl : makeEl(); },
    createElement() { return makeEl(); },
  };

  let activationListener = null;
  let messageListener = null;
  let pendingLookup = null;
  let queryCalls = 0;
  const settingsReads = [];
  const captureChrome = {
    runtime: {
      onMessage: { addListener(fn) { messageListener = fn; } },
      sendMessage() {},
      lastError: null,
    },
    tabs: {
      // The sidebar's own tab lookup is the first query, and Chrome answers
      // it on a later task. Holding its answer here is what lets the
      // assertions below see the sidebar between opening and binding. Every
      // later query is the bus finding a tab for one of the sidebar's reads,
      // and answers at once.
      query(q, cb) {
        queryCalls++;
        if (queryCalls === 1) {
          pendingLookup = cb;
          return;
        }
        cb([{ id: BOUND_TAB, windowId: BOUND_WINDOW }]);
      },
      sendMessage(tabId, msg, cb) {
        if (msg.action === 'request:settings') {
          settingsReads.push(tabId);
          cb({ settings: Object.assign({}, DR_DEFAULTS) });
          return;
        }
        cb(undefined);
      },
      onActivated: { addListener(fn) { activationListener = fn; } },
    },
  };

  let closes = 0;
  const savedDoc = global.document;
  const savedChrome = global.chrome;
  const savedWindow = global.window;
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.window = {
    addEventListener() {},
    close() { closes++; },
    getComputedStyle: () => ({ display: 'block' }),
  };

  let evalError = null;
  try {
    eval(
      constantsCode + '\n' +
      roundingSrc + '\n' +
      coreSrc + '\n' +
      messagingCode + '\n' +
      fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8')
    );
  } catch (e) {
    evalError = e;
  }

  try {
    eq('bound tab wiring: the sidebar evaluated without error',
      evalError === null ? 'none' : evalError.message, 'none');
    eq('bound tab wiring: the sidebar registered a message listener',
      typeof messageListener, 'function');
    if (typeof messageListener !== 'function') return;

    // Between opening and binding. Nothing may go out to a page yet: the
    // sidebar has no tab to compare an answer or a report against, and an
    // activation arriving now would have nothing to compare either.
    eq('bound tab wiring: the sidebar asked which tab it was opened for',
      queryCalls, 1);
    eq('bound tab wiring: no read goes out before the tab lookup answers',
      settingsReads, []);
    eq('bound tab wiring: no activation is watched before the tab lookup answers',
      activationListener, null);

    pendingLookup([{ id: BOUND_TAB, windowId: BOUND_WINDOW }]);

    eq('bound tab wiring: the opening read goes to the bound tab once the lookup answers',
      settingsReads, [BOUND_TAB]);
    eq('bound tab wiring: the sidebar registered an activation listener',
      typeof activationListener, 'function');
    if (typeof activationListener !== 'function') return;

    // A locked-table report from another tab must not reach the controls.
    // The lock is the loudest of the eight reports: it writes the status and
    // stops the sidebar accepting input.
    messageListener({ action: 'state:applyBlocked' }, { tab: { id: OTHER_TAB } }, () => {});
    eq('bound tab wiring: a lock reported by another tab does not lock the sidebar',
      bodyClasses.has('table-locked'), false);

    // The same report from the bound tab does reach them.
    messageListener({ action: 'state:applyBlocked' }, { tab: { id: BOUND_TAB } }, () => {});
    eq('bound tab wiring: a lock reported by the bound tab locks the sidebar',
      bodyClasses.has('table-locked'), true);

    // Switching to another tab in the sidebar's own window closes it.
    eq('bound tab wiring: the sidebar is open before any switch', closes, 0);
    activationListener({ tabId: OTHER_TAB, windowId: BOUND_WINDOW });
    eq('bound tab wiring: switching to another tab closes the sidebar', closes, 1);
  } finally {
    global.document = savedDoc;
    global.chrome = savedChrome;
    global.window = savedWindow;
  }
})();

(function currencies_noSecondList() {
  // Fail closed on a restated list. A second copy of the signs necessarily
  // carries several currency pictures, so no content script outside core.js
  // may hold more than one distinct picture. The dollar sign stays out of the
  // scan: it is ordinary regular-expression and template syntax. A file that
  // legitimately needs several pictures reads CURRENCY_SIGNS instead.
  const pictures = /[€£¥₹₽₺₣]/g;
  const offenders = [];
  for (const [file, src] of contentScriptSources) {
    if (file === 'lib/dr-number/core.js') continue; // the one list lives here
    const distinct = new Set(src.match(pictures) || []);
    if (distinct.size > 1) offenders.push(file);
  }
  eq('currencies: no content script outside the one list spells out the currency signs',
    offenders, []);
})();
