/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * DynamicRounding lib/dr-capture package: the capture file renderer.
 *
 * buildCaptureDocument() turns one capture state into one self-contained
 * HTML document — a string in, a string out, no browser API touched. The
 * document reads as a report: the mark and note on top, the focused table
 * beside a likeness of the sidebar, the log rows of both contexts, the
 * fixture seed as readable text, and the whole state as machine-readable
 * JSON at the bottom.
 *
 * Safety doctrine, adapted from the model extension's capture for string
 * assembly (the test harness has no DOM, so the document cannot be built as
 * nodes and serialized):
 *
 * 1. Every dynamic value passes through escapeHtml() on its way into the
 *    string. No interpolation of raw state exists in this file; the
 *    hostile-payload tests in tests.js attack this directly.
 * 2. The file declares its own Content-Security-Policy meta tag —
 *    script-src 'none', img-src data: — and carries no script element, so
 *    a renderer bug cannot become code execution and a remote reference in
 *    a payload cannot tell its origin server the capture was opened.
 * 3. A hidden pre holds the full state as escaped JSON. A pre and not a
 *    script-typed island: a script element is raw text, so a payload holding
 *    an end-script tag would break out of it. Extracting the state means
 *    taking the pre's textContent and parsing it as JSON.
 * 4. The capture carries the fixture seed twice: an escaped visible block
 *    for reading, and the JSON copy for byte-exact trust — the HTML parser
 *    folds CR and drops a leading newline in a pre, JSON.stringify does not.
 *
 * The sidebar likeness is deliberately crude — positions and states, no
 * pixel fidelity. The JSON island carries the precision; the likeness only
 * has to show what stood where. Status wording (the locked
 * message) arrives as a value from the caller, so this file holds no copy
 * of text that already lives elsewhere.
 */

const CAPTURE_CSP = [
  "script-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "img-src data:",
].join('; ');

const CAPTURE_MARK_GLYPHS = {
  positive: '\u{1F44D}',
  question: '\u{1F914}',
  negative: '\u{1F44E}',
};

const CAPTURE_STYLES = [
  'body { font: 14px/1.5 system-ui, sans-serif; margin: 24px; color: #1a1a1a; background: #fff; }',
  'h1 { font-size: 18px; margin: 0 0 4px; }',
  'h2 { font-size: 15px; margin: 24px 0 8px; }',
  'h3 { font-size: 13px; margin: 12px 0 4px; }',
  '.cap-mark { font-size: 20px; margin: 4px 0; }',
  '.cap-mark span { font-size: 13px; color: #555; vertical-align: middle; }',
  'dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 8px 0; }',
  'dt { color: #555; } dd { margin: 0; overflow-wrap: anywhere; }',
  '.cap-note { border-left: 3px solid #3d85c6; padding: 4px 12px; margin: 12px 0; }',
  '.cap-note p { margin: 2px 0; white-space: pre-wrap; }',
  '.cap-visual { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }',
  '.cap-page { flex: 1 1 320px; }',
  '.cap-panel { flex: 0 0 260px; border: 1px solid #ccc; border-radius: 8px; padding: 12px; }',
  'table.cap-table { border-collapse: collapse; }',
  '.cap-table th, .cap-table td { border: 1px solid #bbb; padding: 4px 10px; text-align: right; }',
  '.cap-table th { background: #f2f2f2; }',
  '.cap-simplified { text-decoration: underline dotted #3d85c6; cursor: help; }',
  '.cap-locked, .cap-empty { color: #8a6d3b; background: #fcf8e3; padding: 6px 10px; border-radius: 4px; margin: 8px 0; }',
  '.cap-switch { display: flex; justify-content: space-between; margin: 2px 0; }',
  '.cap-switch b { font-weight: 600; }',
  '.cap-rail { position: relative; height: 6px; background: #ddd; border-radius: 3px; margin: 18px 4px 22px; }',
  '.cap-thumb { position: absolute; top: -5px; width: 16px; height: 16px; border-radius: 50%; background: #1a73e8; transform: translateX(-50%); z-index: 1; }',
  '.cap-thumb.cap-thumb-bot { top: 6px; width: 12px; height: 12px; background: #b3623d; z-index: 0; }',
  '.cap-thumb.cap-thumb-bot.cap-coupled { background: #c48a6a; }',
  '.cap-band { color: #555; margin: 2px 0; }',
  '.cap-status { min-height: 1.2em; color: #8a6d3b; }',
  '.cap-log { font: 12px/1.5 ui-monospace, monospace; margin: 4px 0; padding-left: 0; list-style: none; }',
  '.cap-log li { overflow-wrap: anywhere; }',
  '.cap-log .warn { color: #8a6d3b; } .cap-log .error { color: #a94442; }',
  'pre.cap-seed { border: 1px solid #ccc; border-radius: 4px; padding: 8px; overflow-x: auto; font-size: 12px; }',
  'footer { color: #777; font-size: 12px; margin-top: 24px; border-top: 1px solid #ddd; padding-top: 8px; }',
].join('\n');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A meta value for display: the value, or a dash for an absent one. */
function displayValue(value) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

/* ------------------------------------------------------------- filenames */

function capturePad2(n) {
  return String(n).padStart(2, '0');
}

// The hostname, reduced to something a filename can hold. Chrome strips
// path separators out of a download name anyway; build them out here.
function captureHostSlug(url) {
  if (!url) return 'no-source';
  let host;
  try {
    host = new URL(url).hostname;
  } catch (e) {
    return 'no-source';
  }
  const slug = host.toLowerCase()
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'no-source';
}

// Date first so captures sort beside date-named fixtures; time last so a
// second capture of the same page is a new file, never Chrome's "(1)" copy.
function captureFilenameFor(opts) {
  const at = opts.at;
  const date = at.getFullYear() + '-' + capturePad2(at.getMonth() + 1) + '-' + capturePad2(at.getDate());
  const time = capturePad2(at.getHours()) + capturePad2(at.getMinutes()) + capturePad2(at.getSeconds());
  return 'dr-capture-' + date + '-' + captureHostSlug(opts.url) + '-' + time + '.html';
}

/* --------------------------------------------------------------- sections */

function renderCaptureHeader(state) {
  const meta = state.meta || {};
  const glyph = CAPTURE_MARK_GLYPHS[state.mark] || '';
  const rows = [
    ['Page', displayValue(meta.url)],
    ['Title', displayValue(meta.title)],
    ['Extension version', displayValue(meta.version)],
    ['Platform', displayValue(meta.platform)],
    ['Taken', displayValue(meta.at)],
    ['Capture format', displayValue(state.captureFormat)],
  ].map(function (pair) {
    return '<dt>' + escapeHtml(pair[0]) + '</dt><dd>' + escapeHtml(pair[1]) + '</dd>';
  }).join('');
  // The note is one free-text field; line breaks the user typed survive
  // through the pre-wrap rule on .cap-note.
  const noteRow = '<p><b>Remarks:</b> ' + escapeHtml(displayValue(state.note)) + '</p>';
  // What the file holds, stated where the person about to attach it reads
  // it: the script-free CSP makes the file safe to open, and this line
  // covers the other half — the values it carries.
  const holdsRow = '<p class="cap-band">This capture holds the page’s table contents, ' +
    'its address and title, and browser details. Share it as you would share the page.</p>';
  return '<header>' +
    '<h1>DynamicRounding capture</h1>' +
    '<p class="cap-mark">' + glyph + ' <span>' + escapeHtml(displayValue(state.mark)) + '</span></p>' +
    '<dl>' + rows + '</dl>' +
    holdsRow +
    '<section class="cap-note">' + noteRow + '</section>' +
    '</header>';
}

// One rendering of the focused table's cells, rebuilt as a real table of
// escaped text — never cloned markup. mode 'displayed' shows what the screen
// showed; a simplified cell (its original differs from what it shows) gets
// the original in its title, so hover reveals it the way the live page does.
// mode 'originals' shows the originals themselves; a cell with no stored
// original shows its displayed text, which for an unchanged cell IS the
// original.
function renderCapTable(table, mode) {
  const byRow = [];
  for (let i = 0; i < table.cells.length; i++) {
    const cell = table.cells[i];
    if (!byRow[cell.row]) byRow[cell.row] = [];
    byRow[cell.row].push(cell);
  }
  const rowsHtml = byRow.map(function (rowCells) {
    const cellsHtml = (rowCells || []).map(function (cell) {
      const tag = cell.role === 'th' ? 'th' : 'td';
      if (mode === 'originals') {
        const value = cell.original !== null ? cell.original : cell.text;
        return '<' + tag + '>' + escapeHtml(value) + '</' + tag + '>';
      }
      const simplified = cell.original !== null && cell.original !== cell.text;
      const titleAttr = simplified
        ? ' class="cap-simplified" title="Original: ' + escapeHtml(cell.original) + '"'
        : '';
      return '<' + tag + titleAttr + '>' + escapeHtml(cell.text) + '</' + tag + '>';
    }).join('');
    return '<tr>' + cellsHtml + '</tr>';
  }).join('');
  return '<table class="cap-table">' + rowsHtml + '</table>';
}

// The focused table twice: as displayed, then with the originals, so both
// forms are readable without hovering. The hover reveal on the displayed
// copy stays for cell-by-cell comparison.
function renderFocusedTable(state, lockedStatusText) {
  const table = state.activeTableIndex === null || state.activeTableIndex === undefined
    ? null
    : state.tables[state.activeTableIndex];
  if (!table) {
    return '<p class="cap-empty">No table was bound when this capture was taken. ' +
      'The state below records everything the extension had.</p>';
  }
  const lockedHtml = table.locked
    ? '<p class="cap-locked">' + escapeHtml(lockedStatusText || '') + '</p>'
    : '';
  const caption = escapeHtml(table.kind) + ' table, ' +
    escapeHtml(String(table.rowCount)) + ' row(s) × ' +
    escapeHtml(String(table.columnCount)) + ' column(s), showing ' +
    escapeHtml(table.appliedFlag === 'simplified' ? 'simplified values' : 'original values');
  return '<h3>' + caption + '</h3>' +
    lockedHtml +
    renderCapTable(table, 'displayed') +
    '<p class="cap-band">Hover a dotted cell to see its original.</p>' +
    '<h3>The same table, with the originals</h3>' +
    renderCapTable(table, 'originals');
}

// Every table the registry held, one line each, the focused one marked. The
// full per-cell detail sits in the JSON island; this list shows at a glance
// what was found.
function renderRegistrySection(state) {
  const rows = (state.tables || []).map(function (table, index) {
    const focused = index === state.activeTableIndex;
    const label = table.kind === 'unknown'
      ? 'serialization failed: ' + (table.error || '')
      : table.kind + ', ' + table.rowCount + ' row(s) × ' + table.columnCount +
        ' column(s), form: ' + (table.appliedFlag === 'simplified' ? 'simplified' : 'raw') +
        (table.locked ? ', locked' : '');
    return '<div class="cap-switch"><span>#' + (index + 1) + ' — ' + escapeHtml(label) +
      '</span><b>' + (focused ? 'focused' : '') + '</b></div>';
  }).join('');
  const body = rows || '<p class="cap-empty">The registry held no tables.</p>';
  return '<section><h2>Registry</h2>' + body + '</section>';
}

// The sidebar likeness: positions and states from plain values, rendered
// open, under this file's own stylesheet — no page CSS, no cloned nodes,
// and deliberately crude. The JSON island carries the precision.
function renderSidebarLikeness(state, lockedStatusText) {
  const view = state.sidebarView;
  if (!view) {
    return '<div class="cap-panel"><p class="cap-empty">No sidebar view state was recorded.</p></div>';
  }
  const onOff = function (isOn) { return isOn ? 'on' : 'off'; };
  const switchRow = function (label, isOn) {
    return '<div class="cap-switch"><span>' + escapeHtml(label) + '</span><b>' +
      onOff(!!isOn) + '</b></div>';
  };
  const switches = Object.keys(view.switches || {}).map(function (key) {
    return switchRow(key, view.switches[key]);
  }).join('');

  const stops = Array.isArray(view.stops) && view.stops.length > 1 ? view.stops : null;
  const pct = function (value) {
    if (!stops) return 50;
    const idx = stops.indexOf(value);
    return idx === -1 ? 50 : (idx / (stops.length - 1)) * 100;
  };
  // Both thumbs always render, matching the live control: coupled shows the
  // brown thumb tucked under the blue one at the same stop.
  const thumbs =
    '<span class="cap-thumb" style="left: ' + pct(view.topVal) + '%"></span>' +
    '<span class="cap-thumb cap-thumb-bot' + (view.coupled ? ' cap-coupled' : '') +
      '" style="left: ' + pct(view.coupled ? view.topVal : view.botVal) + '%"></span>';
  const lens = view.lensPreview || { top: [], bottom: [] };
  const bandRows = function (rows) {
    return (rows || []).map(function (row) {
      return '<div class="cap-band">' + escapeHtml(row) + '</div>';
    }).join('') || '<div class="cap-band">—</div>';
  };

  return '<div class="cap-panel">' +
    '<h3>Sidebar (rendered open)</h3>' +
    switchRow('Rounding', view.enabled) +
    switches +
    '<div class="cap-switch"><span>Dates</span><b>' + escapeHtml(displayValue(view.dateGranularity)) + '</b></div>' +
    '<div class="cap-switch"><span>Times</span><b>' + escapeHtml(displayValue(view.timeGranularity)) + '</b></div>' +
    '<h3>Lens control (' +
      (view.coupled
        ? 'coupled, both at ' + escapeHtml(displayValue(view.topVal))
        : 'top ' + escapeHtml(displayValue(view.topVal)) +
          ', other ' + escapeHtml(displayValue(view.botVal))) +
    ')</h3>' +
    '<div class="cap-rail">' + thumbs + '</div>' +
    '<h3>Lens preview</h3>' +
    bandRows(lens.top) +
    bandRows(lens.bottom) +
    (view.locked ? '<p class="cap-locked">' + escapeHtml(lockedStatusText || '') + '</p>' : '') +
    '<p class="cap-status">' + escapeHtml(displayValue(view.status)) + '</p>' +
    '</div>';
}

// Both contexts' log rows, labeled by provenance. An empty buffer is a
// finding, so it renders as a sentence, never as a missing section.
function renderCaptureLogs(state) {
  const log = state.log || {};
  const section = function (label, snap) {
    const rows = snap && Array.isArray(snap.entries) ? snap.entries : [];
    const dropped = snap && snap.dropped ? '<li>(' + escapeHtml(String(snap.dropped)) +
      ' earlier row(s) dropped past the cap)</li>' : '';
    const items = rows.map(function (row) {
      return '<li class="' + escapeHtml(row.level) + '">' + escapeHtml(row.at) + ' [' +
        escapeHtml(row.level) + '] ' + escapeHtml(row.text) + '</li>';
    }).join('');
    const body = rows.length === 0
      ? '<p class="cap-band">Nothing was logged.</p>'
      : '<ul class="cap-log">' + dropped + items + '</ul>';
    return '<h3>' + escapeHtml(label) + '</h3>' + body;
  };
  return '<section><h2>Extension logs</h2>' +
    section('Content script', log.content) +
    section('Sidebar', log.sidebar) +
    '<p class="cap-band">Service worker rows are not captured.</p>' +
    '</section>';
}

function renderFixtureSeed(state) {
  if (!state.fixtureSeed) {
    return '<section><h2>Fixture seed</h2>' +
      '<p class="cap-empty">No fixture seed: no table was bound.</p></section>';
  }
  return '<section><h2>Fixture seed</h2>' +
    '<p class="cap-band">The focused table’s raw markup, escaped here for reading. ' +
    'The JSON below carries it byte-exact.</p>' +
    '<pre class="cap-seed">' + escapeHtml(state.fixtureSeed) + '</pre></section>';
}

/**
 * The whole capture document. input.state is the full capture state — it
 * becomes the JSON island verbatim, and every visible section renders from
 * it. input.lockedStatusText is the locked-table wording, passed in as a
 * value because it already lives in the sidebar and the pill title.
 */
function buildCaptureDocument(input) {
  const state = input.state;
  const lockedStatusText = input.lockedStatusText;
  const meta = state.meta || {};
  // data-dr-capture is the capture marker: a saved capture holds a real
  // table, and with file access enabled Chrome injects this extension's own
  // content scripts into the opened file. The controller reads this marker
  // and stands down (see content.js's IS_CAPTURE_PAGE), so a capture always
  // shows what was captured, never what the extension would do to it.
  return '<!DOCTYPE html>\n<html lang="en" data-dr-capture="1">\n<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta http-equiv="Content-Security-Policy" content="' + CAPTURE_CSP + '">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>DynamicRounding capture — ' + escapeHtml(displayValue(meta.title)) + '</title>\n' +
    '<style>\n' + CAPTURE_STYLES + '\n</style>\n' +
    '</head>\n<body>\n' +
    renderCaptureHeader(state) +
    '<main>' +
    '<section><h2>What the extension saw</h2><div class="cap-visual">' +
    '<div class="cap-page">' + renderFocusedTable(state, lockedStatusText) + '</div>' +
    renderSidebarLikeness(state, lockedStatusText) +
    '</div></section>' +
    renderRegistrySection(state) +
    renderCaptureLogs(state) +
    renderFixtureSeed(state) +
    '<footer>The hidden block below, id capture-state, holds the full capture state ' +
    'as JSON, escaped for HTML.</footer>' +
    '</main>\n' +
    '<pre id="capture-state" hidden>' + escapeHtml(JSON.stringify(state, null, 2)) + '</pre>\n' +
    '</body>\n</html>\n';
}
