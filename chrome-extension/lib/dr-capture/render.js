// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * DynamicRounding lib/dr-capture package: the capture file renderer.
 *
 * buildCaptureDocument() turns one capture state into one self-contained
 * HTML document — plain values in, one string out, no browser API touched. The
 * document reads as a report, top to bottom: a header of facts, the mark and
 * remarks, a likeness of the sidebar, the screenshot, the bound table, the
 * registry, the detection settings in force, the log rows of both contexts, the
 * fixture seed as readable text, and the whole state as machine-readable
 * JSON at the bottom.
 *
 * Safety doctrine for string assembly (the test harness has no DOM, so the
 * document cannot be built as nodes and serialized):
 *
 * 1. Every dynamic value passes through escapeHtml() on its way into the
 *    string. No interpolation of raw state exists in this file; the
 *    hostile-payload tests in tests/capture-log-tests.js attack this directly.
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
 */

const CAPTURE_CSP = [
  "script-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "img-src data:",
].join('; ');

const CAPTURE_MARK_GLYPHS = {
  'looks-right': '\u{1F44D}',
  'not-sure': '\u{1F914}',
  'looks-wrong': '\u{1F44E}',
};

// Own-property check: only the three mark tokens pass. A bare lookup would
// resolve prototype property names too, and the glyph is interpolated as
// markup.
function isCaptureMark(token) {
  return Object.prototype.hasOwnProperty.call(CAPTURE_MARK_GLYPHS, token);
}

// The mark's word for reading, derived from its token — "looks-right" reads
// "Looks right" — so the glyph map above stays the one list of marks. Only the
// three mark tokens derive a word; any other value goes through displayValue,
// and the caller escapes it like every other value.
function captureMarkLabel(token) {
  if (!isCaptureMark(token)) {
    return displayValue(token);
  }
  const words = String(token).split('-').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const CAPTURE_STYLES = [
  'body { font: 14px/1.5 system-ui, sans-serif; margin: 24px; color: #1a1a1a; background: #fff; }',
  'h1 { font-size: 18px; margin: 0 0 4px; }',
  'h2 { font-size: 15px; margin: 0 0 8px; }',
  'h3 { font-size: 13px; margin: 12px 0 4px; }',
  '.cap-meta { font-size: 12px; color: #666; margin: 4px 0 0; }',
  '.cap-meta dt { color: #888; }',
  'main > section { border-top: 1px solid #ddd; margin-top: 16px; padding-top: 8px; }',
  '.cap-mark { font-size: 20px; }',
  '.cap-mark span { font-size: 13px; color: #555; vertical-align: middle; }',
  'dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 8px 0; }',
  'dt { color: #555; } dd { margin: 0; overflow-wrap: anywhere; }',
  '.cap-remarks { border-left: 3px solid #3d85c6; padding: 4px 12px; margin: 12px 0; }',
  '.cap-remarks p { margin: 2px 0; white-space: pre-wrap; }',
  '.cap-note { font-size: 13px; font-style: italic; color: #555; margin: 4px 0; }',
  '.cap-panel { max-width: 320px; border: 1px solid #ccc; border-radius: 8px; padding: 12px; }',
  'img.cap-shot { max-width: 100%; border: 1px solid #ccc; }',
  'table.cap-table { border-collapse: collapse; }',
  '.cap-table th, .cap-table td { border: 1px solid #bbb; padding: 4px 10px; text-align: right; }',
  '.cap-table th { background: #f2f2f2; }',
  '.cap-simplified { text-decoration: underline dotted #3d85c6; cursor: help; }',
  '.cap-lost { color: #8a6d3b; font-style: italic; }',
  '.cap-empty { color: #8a6d3b; background: #fcf8e3; padding: 6px 10px; border-radius: 4px; margin: 8px 0; }',
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
  '.cap-log details { margin: 2px 0 6px 16px; } .cap-log summary { cursor: pointer; color: #555; }',
  'pre.cap-trace { margin: 4px 0; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; white-space: pre-wrap; overflow-wrap: anywhere; }',
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

/* ------------------------------------------------------------ file names */

function capturePad2(n) {
  return String(n).padStart(2, '0');
}

// A value reduced to something a file name can hold: lower case, runs of
// anything outside a-z and 0-9 collapsed to one dash, edge dashes trimmed.
// Chrome strips path separators out of a download name anyway; build them
// out here.
function captureSlug(value) {
  return String(value).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// The page's source for the file name: its host with the www. dropped, or,
// for a page opened from disk (a file: URL has no host), the page file's
// name without its extension. 'no-source' stands for no address, an address
// that does not parse, or one that yields no name (file:///, about:blank).
function captureSourceSlug(url) {
  if (!url) return 'no-source';
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return 'no-source';
  }
  let source;
  if (parsed.protocol === 'file:') {
    const segment = parsed.pathname.split('/').filter(Boolean).pop() || '';
    let name = segment;
    try {
      name = decodeURIComponent(segment);
    } catch (e) {
      // A malformed escape keeps the raw segment.
    }
    source = name.replace(/\.[^.]*$/, '');
  } else {
    source = parsed.hostname.replace(/^www\./, '');
  }
  return captureSlug(source) || 'no-source';
}

// Compact date first so captures sort by day; time after the source so a
// second capture of the same page is a new file, never Chrome's "(1)" copy;
// the mark token last, so a folder listing shows each file's verdict.
function captureFilenameFor(opts) {
  const at = opts.at;
  const date = at.getFullYear() + capturePad2(at.getMonth() + 1) + capturePad2(at.getDate());
  const time = capturePad2(at.getHours()) + capturePad2(at.getMinutes()) + capturePad2(at.getSeconds());
  return 'dr-capture-' + date + '-' + captureSourceSlug(opts.url) + '-' + time +
    '-' + captureSlug(opts.mark) + '.html';
}

/* ----------------------------------------------------------- size warning */

// The saved file carries the same content about four times — the two table
// renderings, the JSON island, and the visible seed — so the serialized
// state's length times this factor estimates the file's size before any
// file exists. The screenshot stays out of the estimate: it lands once, its
// size is bounded by the viewport (a few hundred thousand characters, under
// a tenth of the warning threshold), and the sidebar computes the size
// warning when the form opens, before any screenshot exists.
const CAPTURE_FILE_CHARS_PER_STATE_CHAR = 4;
// Estimates at or above this many characters (about 4 MB) get a size
// warning on the capture form. The full-detail default stays: the warning
// informs the save, it never blocks it.
const CAPTURE_SIZE_WARN_CHARS = 4 * 1000 * 1000;

/**
 * A size warning for the capture form: null for an ordinary state, one
 * sentence with the estimated file size for a large one. The caller passes
 * the same pulled state the file would be built from.
 */
function captureSizeWarning(state) {
  let length;
  try {
    length = JSON.stringify(state).length;
  } catch (e) {
    return null;
  }
  const estimate = length * CAPTURE_FILE_CHARS_PER_STATE_CHAR;
  if (estimate < CAPTURE_SIZE_WARN_CHARS) return null;
  return 'This capture will be large: about ' +
    Math.round(estimate / (1000 * 1000)) + ' MB.';
}

/* --------------------------------------------------------------- sections */

// A reader note: a sentence or two about how to read the file, never a
// finding about the page (an absence renders as an absence sentence,
// highlighted). The prefix and the class live here alone, so every note
// reads the same.
function renderNote(text) {
  return '<p class="cap-note">Note: ' + escapeHtml(text) + '</p>';
}

function renderAbsence(text) {
  return '<p class="cap-empty">' + escapeHtml(text) + '</p>';
}

function renderSection(heading, body) {
  return '<section><h2>' + escapeHtml(heading) + '</h2>' + body + '</section>';
}

function renderLabeledRow(label, value) {
  return '<div class="cap-switch"><span>' + escapeHtml(label) + '</span><b>' +
    escapeHtml(value) + '</b></div>';
}

// The header holds the facts alone: the title and a small muted list. The
// mark and the remarks follow in their own section, so the eye lands on
// them first among the content.
function renderCaptureHeader(state) {
  const meta = state.meta || {};
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
  return '<header>' +
    '<h1>DynamicRounding capture</h1>' +
    '<dl class="cap-meta">' + rows + '</dl>' +
    '</header>';
}

function renderMarkAndRemarks(state) {
  const glyph = isCaptureMark(state.mark) ? CAPTURE_MARK_GLYPHS[state.mark] : '';
  // The remarks are one free-text field; line breaks the user typed survive
  // through the pre-wrap rule on .cap-remarks p.
  return '<section class="cap-remarks">' +
    '<p class="cap-mark">' + glyph + ' <span>' + escapeHtml(captureMarkLabel(state.mark)) + '</span></p>' +
    '<p><b>Remarks:</b> ' + escapeHtml(displayValue(state.remarks)) + '</p>' +
    '</section>';
}

// One rendering of the bound table's cells, rebuilt as a real table of
// escaped text — never cloned markup. mode 'displayed' shows what the screen
// showed; a simplified cell (its original differs from what it shows) gets
// the original in its title, so hover reveals it the way the live page does.
// mode 'originals' shows the originals themselves. A cell with no stored
// original splits on the marker class: with the marker class the original is
// lost and renders as that absence, never a substituted value; without it
// the cell was never rounded, so its displayed text IS the original.
function renderCapTable(table, mode) {
  // Each cell goes in the slot its recorded column names, not in the next
  // free one. A row under a merge holds fewer cells than the table has
  // columns, so packing them left to right would draw every cell after the
  // merge one column early, under the wrong header.
  const byRow = [];
  for (let i = 0; i < table.cells.length; i++) {
    const cell = table.cells[i];
    if (!byRow[cell.row]) byRow[cell.row] = [];
    byRow[cell.row][cell.col] = cell;
  }
  // Array.from over the length, not map, at both levels: a row whose cells
  // skip a column and a table whose state holds no cell for a row are both
  // sparse arrays, and map passes over the holes that are the whole point.
  // Each row draws to the table's full width, so the columns a merge covers
  // render blank wherever the merge sits, its right edge included.
  const width = table.columnCount || 0;
  const rowsHtml = Array.from(byRow, function (rowCells) {
    const cells = rowCells || [];
    const cellsHtml = Array.from({ length: Math.max(cells.length, width) }, function (_, col) {
      const cell = cells[col];
      if (!cell) return '<td></td>';
      const tag = cell.role === 'th' ? 'th' : 'td';
      if (mode === 'originals') {
        if (cell.original === null && cell.wearsMarker) {
          return '<' + tag + ' class="cap-lost">original lost</' + tag + '>';
        }
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

// The bound table twice: as displayed, then with the originals, so both
// forms are readable without hovering. The hover reveal on the displayed
// copy stays for cell-by-cell comparison.
function renderBoundTable(state) {
  const table = (state.tables || [])[state.activeTableIndex];
  if (!table) {
    return renderAbsence('No table was bound when this capture was taken. ' +
      'The state below records everything the extension had.');
  }
  // An error record holds a failure, not cells; rendering it through the
  // table path would caption null counts over an empty table and read as a
  // finding about the page. The failure is the finding.
  if (table.kind === 'unknown') {
    return renderAbsence('Serialization of this table failed: ' + (table.error || '') +
      '. The state below records everything the extension had.');
  }
  return '<h3>' + escapeHtml(table.kind + ' table, ' + tableSummary(table)) + '</h3>' +
    renderCapTable(table, 'displayed') +
    renderNote('Hover a dotted cell to see its original.') +
    '<h3>The same table, with the originals</h3>' +
    renderCapTable(table, 'originals') +
    renderNote('Cell spans are not recorded: a merged cell renders in the ' +
      'column it starts at, and the columns it covers render blank, here ' +
      'and in the state below.');
}

// A table shows simplified values when one of its cells carries the marker class.
function shownValues(table) {
  const simplified = (table.cells || []).some(function (cell) { return cell.wearsMarker; });
  return simplified ? 'showing simplified values' : 'showing original values';
}

function tableSummary(table) {
  return table.rowCount + ' row(s) × ' + table.columnCount + ' column(s), ' +
    shownValues(table);
}

// Every table the registry held, one line each, the bound one marked. The
// full per-cell detail sits in the JSON island; this list shows at a glance
// what was found.
function renderRegistrySection(state) {
  const rows = (state.tables || []).map(function (table, index) {
    const bound = index === state.activeTableIndex;
    const label = table.kind === 'unknown'
      ? 'serialization failed: ' + (table.error || '')
      : table.kind + ', ' + tableSummary(table);
    return renderLabeledRow('#' + (index + 1) + ' — ' + label, bound ? 'bound' : '');
  }).join('');
  const body = rows || renderAbsence('The registry held no tables.');
  return renderSection('Registry', body);
}

function renderSettingValue(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return escapeHtml(displayValue(null));
    return value.map(function (item) { return escapeHtml(item); }).join(', ');
  }
  return escapeHtml(displayValue(value));
}

// Every key of the detection settings, in the object's own order — no key
// list lives here, so a key added to DR_DETECTION_SETTINGS prints with no
// renderer change when it holds a scalar, a list of strings, or a list of
// flat profile objects.
function renderDetectionSettingsRows(settings) {
  return Object.keys(settings).map(function (key) {
    const value = settings[key];
    const isProfileList = Array.isArray(value) && value.length > 0 &&
      typeof value[0] === 'object' && value[0] !== null;
    if (isProfileList) {
      return value.map(function (profile) {
        const fields = Object.keys(profile).map(function (field) {
          return escapeHtml(field) + ': ' + renderSettingValue(profile[field]);
        }).join('; ');
        return '<dt>' + escapeHtml(key) + '</dt><dd>' + fields + '</dd>';
      }).join('');
    }
    return '<dt>' + escapeHtml(key) + '</dt><dd>' + renderSettingValue(value) + '</dd>';
  }).join('');
}

// The detection settings in force at capture time: every key of
// state.detectionSettings with its value, so a looks-wrong capture shows
// the values detection ran under. A failed state pull leaves
// detectionSettings null; the section still renders, with one row holding
// the absence placeholder, so the capture still saves.
function renderDetectionSettingsSection(state) {
  const settings = state.detectionSettings;
  const body = settings
    ? '<dl>' + renderDetectionSettingsRows(settings) + '</dl>'
    : '<dl><dt>detectionSettings</dt><dd>' + escapeHtml(displayValue(null)) + '</dd></dl>';
  return renderSection('Detection settings', body);
}

// The one shape an image may take on its way into the file: a JPEG or PNG
// data URL whose payload is base64 alone. A value of any other shape never
// reaches the src attribute — no other scheme, no quote, no attribute.
const CAPTURE_IMAGE_DATA_URL = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/;

// The screenshot the sidebar took at finish: the bound tab's visible area.
// The image arrives beside the state, never inside it; the state holds the
// take's record alone, so the JSON island stays small. A take that failed,
// a record that is missing, and image data outside the one accepted shape
// each render as an absence that states the reason — never as an empty
// frame.
function renderScreenshotSection(state, dataUrl) {
  const record = state.screenshot;
  let body;
  if (!record) {
    body = renderAbsence('No screenshot was recorded.');
  } else if (!record.taken) {
    body = renderAbsence('No screenshot: ' + displayValue(record.reason) + '.');
  } else if (typeof dataUrl !== 'string' || !CAPTURE_IMAGE_DATA_URL.test(dataUrl)) {
    body = renderAbsence('No screenshot: the image data was not an image data URL.');
  } else {
    body = '<img class="cap-shot" src="' + escapeHtml(dataUrl) +
      '" alt="The bound tab as it stood at capture time">' +
      renderNote('The tab’s visible area at the Save capture press. ' +
        'The sidebar is browser UI and is not in the image.');
  }
  return renderSection('Screenshot', body);
}

// The sidebar likeness: positions and states from plain values, rendered
// open, under this file's own stylesheet — no page CSS, no cloned nodes,
// and deliberately crude. The JSON island carries the precision.
function renderSidebarLikeness(state) {
  // tests/sidebar-tests.js scans this file's source for the keys read off the
  // local names sidebarSnapshot and lens, so a rename of either fails it.
  const sidebarSnapshot = state.sidebarSnapshot;
  if (!sidebarSnapshot) {
    return '<div class="cap-panel">' + renderAbsence('No sidebar snapshot was recorded.') + '</div>';
  }
  const switches = Object.keys(sidebarSnapshot.switches || {}).map(function (key) {
    return renderLabeledRow(key, sidebarSnapshot.switches[key] ? 'on' : 'off');
  }).join('');

  const stops = Array.isArray(sidebarSnapshot.stops) && sidebarSnapshot.stops.length > 1 ? sidebarSnapshot.stops : null;
  const pct = function (value) {
    if (!stops) return 50;
    const idx = stops.indexOf(value);
    return idx === -1 ? 50 : (idx / (stops.length - 1)) * 100;
  };
  // Both thumbs always render, matching the live control: coupled shows the
  // brown thumb tucked under the blue one at the same stop.
  const thumbs =
    '<span class="cap-thumb" style="left: ' + pct(sidebarSnapshot.topVal) + '%"></span>' +
    '<span class="cap-thumb cap-thumb-bot' + (sidebarSnapshot.coupled ? ' cap-coupled' : '') +
      '" style="left: ' + pct(sidebarSnapshot.coupled ? sidebarSnapshot.topVal : sidebarSnapshot.otherVal) + '%"></span>';
  const lens = sidebarSnapshot.lensPreview || {};
  const bandRows = function (rows) {
    return (rows || []).map(function (row) {
      return '<div class="cap-band">' + escapeHtml(row) + '</div>';
    }).join('') || '<div class="cap-band">—</div>';
  };

  return '<div class="cap-panel">' +
    renderLabeledRow('Rounding', sidebarSnapshot.enabled ? 'on' : 'off') +
    switches +
    renderLabeledRow('Dates', displayValue(sidebarSnapshot.dateGranularity)) +
    renderLabeledRow('Times', displayValue(sidebarSnapshot.timeGranularity)) +
    '<h3>Lens control (' +
      (sidebarSnapshot.coupled
        ? 'coupled, both at ' + escapeHtml(displayValue(sidebarSnapshot.topVal))
        : 'top ' + escapeHtml(displayValue(sidebarSnapshot.topVal)) +
          ', other ' + escapeHtml(displayValue(sidebarSnapshot.otherVal))) +
    ')</h3>' +
    '<div class="cap-rail">' + thumbs + '</div>' +
    '<h3>Lens preview</h3>' +
    bandRows(lens.top) +
    bandRows(lens.other) +
    '<p class="cap-status">' + escapeHtml(displayValue(sidebarSnapshot.status)) + '</p>' +
    '</div>';
}

// The extension's own origin in a stack frame: chrome-extension://, the
// 32-letter id, the slash. Dropping it leaves the path the source tree uses.
const CAPTURE_FRAME_ORIGIN = /^chrome-extension:\/\/[a-p]{32}\//;
// V8's two frame shapes: "at fn (location:line:col)" and, for a frame with
// no name, "at location:line:col".
const CAPTURE_NAMED_FRAME = /^\s*at (.+?) \((.+):(\d+):(\d+)\)$/;
const CAPTURE_BARE_FRAME = /^\s*at (\S+):(\d+):(\d+)$/;

// One stack frame in the short form Chrome's extension error page uses:
// path:line:col (function). The extension's origin drops out of the path;
// a frame with no name reads "(anonymous function)"; "async " and "new "
// stay with the name. A line outside both shapes returns as it is, so the
// reader still sees every line V8 wrote. The result is plain text; the
// caller escapes it at the boundary like every other value.
function formatStackFrame(line) {
  const shortFrame = function (location, lineNumber, column, name) {
    return location.replace(CAPTURE_FRAME_ORIGIN, '') + ':' + lineNumber + ':' + column +
      ' (' + name + ')';
  };
  const named = CAPTURE_NAMED_FRAME.exec(line);
  if (named) return shortFrame(named[2], named[3], named[4], named[1]);
  const bare = CAPTURE_BARE_FRAME.exec(line);
  if (bare) return shortFrame(bare[1], bare[2], bare[3], 'anonymous function');
  return line;
}

// Both contexts' log rows, labeled by provenance. An empty buffer is a
// finding, so it renders as a sentence, never as a missing section — and a
// missing buffer copy is a different finding: the state pull for that context
// failed, so no buffer arrived at all. A row's stack trace (warn and error
// rows carry one) sits under the row in a details element, folded, so a
// reader opens the trace for the row in question, each frame in the short
// form; the JSON island keeps the raw string. details/summary folds without
// a script, so the file's own policy still holds.
function renderCaptureLogs(state) {
  const log = state.log || {};
  const trace = function (row) {
    if (typeof row.stack !== 'string' || row.stack === '') return '';
    const frames = row.stack.split('\n').map(formatStackFrame).join('\n');
    return '<details><summary>Stack trace</summary><pre class="cap-trace">' +
      escapeHtml(frames) + '</pre></details>';
  };
  const section = function (label, buffer) {
    if (!buffer) {
      return '<h3>' + escapeHtml(label) + '</h3>' +
        renderAbsence('The page state pull failed; no log buffer copy arrived.');
    }
    const rows = Array.isArray(buffer.rows) ? buffer.rows : [];
    const dropped = buffer.dropped ? '<li>(' + escapeHtml(buffer.dropped) +
      ' earlier row(s) dropped past the limit)</li>' : '';
    const items = rows.map(function (row) {
      return '<li class="' + escapeHtml(row.level) + '">' + escapeHtml(row.at) + ' [' +
        escapeHtml(row.level) + '] ' + escapeHtml(row.text) + trace(row) + '</li>';
    }).join('');
    const body = rows.length === 0
      ? '<p class="cap-band">Nothing was logged.</p>'
      : '<ul class="cap-log">' + dropped + items + '</ul>';
    return '<h3>' + escapeHtml(label) + '</h3>' + body;
  };
  return renderSection('Extension logs',
    section('Content script', log.content) +
    section('Sidebar', log.sidebar) +
    renderNote('Service worker rows are not captured.'));
}

function renderFixtureSeed(state) {
  if (!state.fixtureSeed) {
    return renderSection('Fixture seed',
      renderAbsence('No fixture seed: no table was bound.'));
  }
  return renderSection('Fixture seed',
    renderNote('The bound table’s markup as it stood at capture time, ' +
      'escaped here for reading. The JSON below carries it byte-exact.') +
    '<pre class="cap-seed">' + escapeHtml(state.fixtureSeed) + '</pre>');
}

/**
 * The whole capture document. input.state is the full capture state — it
 * becomes the JSON island verbatim, and every visible section renders from
 * it. input.screenshotDataUrl is the screenshot the sidebar took, passed beside
 * the state (see renderScreenshotSection).
 */
function buildCaptureDocument(input) {
  const state = input.state;
  const screenshotDataUrl = input.screenshotDataUrl;
  const meta = state.meta || {};
  // data-dr-capture is the capture marker; see IS_CAPTURE_PAGE in content.js.
  return '<!DOCTYPE html>\n<html lang="en" data-dr-capture="1">\n<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta http-equiv="Content-Security-Policy" content="' + CAPTURE_CSP + '">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>DynamicRounding capture — ' + escapeHtml(displayValue(meta.title)) + '</title>\n' +
    '<style>\n' + CAPTURE_STYLES + '\n</style>\n' +
    '</head>\n<body>\n' +
    renderCaptureHeader(state) +
    '<main>' +
    renderMarkAndRemarks(state) +
    renderSection('Sidebar', renderSidebarLikeness(state)) +
    renderScreenshotSection(state, screenshotDataUrl) +
    renderSection('Bound table', renderBoundTable(state)) +
    renderRegistrySection(state) +
    renderDetectionSettingsSection(state) +
    renderCaptureLogs(state) +
    renderFixtureSeed(state) +
    '<footer>The hidden block below, id capture-state, holds the full capture state ' +
    'as JSON, escaped for HTML.</footer>' +
    '</main>\n' +
    '<pre id="capture-state" hidden>' + escapeHtml(JSON.stringify(state, null, 2)) + '</pre>\n' +
    '</body>\n</html>\n';
}
