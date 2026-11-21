// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * The table pillbox view: the table pillbox's geometry, styles, creation and
 * positioning, and the flash and pulse highlights.
 *
 * Module-level state here is drawing state only: button elements, anchor
 * names and their style observers, and once-only flags. The registry and the active table are held
 * in DR_MODEL (app/model.js). On a press, this view publishes an intent topic
 * on DR_BUS for the controller in content.js. Apart from the settings notice
 * subscription below, every other load-time listener this view needs is
 * wired in content.js, which loads after this file.
 */

// Table pillbox geometry constants
const TABLE_PILLBOX_DOT_PX = 10;
const TABLE_PILLBOX_PILL_WIDTH_PX = 28;
const TABLE_PILLBOX_PILL_HEIGHT_PX = 16;
const TABLE_PILLBOX_KNOB_PX = 12;
const TABLE_PILLBOX_KNOB_INSET_PX = 2;
const TABLE_PILLBOX_KNOB_TRAVEL_PX = TABLE_PILLBOX_PILL_WIDTH_PX - TABLE_PILLBOX_KNOB_PX - 2 * TABLE_PILLBOX_KNOB_INSET_PX;
const TABLE_PILLBOX_HIT_PAD_PX = 7;
const TABLE_PILLBOX_DOT_OVERLAP_PX = 8;
const TABLE_PILLBOX_DOT_OVERHANG_PX = 2;
const TABLE_PILLBOX_COLOR_ON = '#3d85c6';
const TABLE_PILLBOX_COLOR_OFF = '#cccccc';
// Touch and pen: an expanded table pillbox collapses on its own after this
// delay. This view alone reads it, so it lives here and not in the detection
// settings.
const TABLE_PILLBOX_AUTO_COLLAPSE_MS = 3000;
// The table pillbox's offset from its table's top-right corner, in the
// coordinates the browser resolves against the table's box.
const TABLE_PILLBOX_OFFSET_X_PX = TABLE_PILLBOX_DOT_OVERHANG_PX - TABLE_PILLBOX_DOT_PX - TABLE_PILLBOX_HIT_PAD_PX;
const TABLE_PILLBOX_OFFSET_Y_PX = TABLE_PILLBOX_DOT_OVERLAP_PX - TABLE_PILLBOX_DOT_PX - TABLE_PILLBOX_HIT_PAD_PX;
// A table with no box, such as one set to display: none, leaves the anchor
// unresolved. The browser then uses this fallback, which places the table
// pillbox far outside the window.
const TABLE_PILLBOX_NO_ANCHOR_PX = -100000;
// Must stay longer than the pulse animation (0.6 s, run twice), so the
// animation ends first.
const PULSE_CLEANUP_MS = 1500;

// --- Per-table pillbox infrastructure ---

// A table (native or grid) → { button, anchor }. anchor holds the table's
// anchor name, the inline anchor name the page last set without the view's
// own (priorAnchorName), and the style observer.
const tablePillboxViews = new WeakMap();
// Every anchor name the view writes starts with this prefix. A content script
// re-injection or a page that copies a table leaves an earlier name on a
// table, and the prefix lets the view find and drop it.
const TABLE_PILLBOX_ANCHOR_PREFIX = '--dr-table-';
// Each content script load names tables with its own token, so a name from an
// earlier load never matches a name from this one.
const TABLE_PILLBOX_ANCHOR_LOAD = Math.random().toString(36).slice(2, 8);
let tablePillboxAnchorCount = 0;

function syncTablePillbox(table) {
  const view = tablePillboxViews.get(table);
  if (!view) return;
  view.button.setAttribute('aria-pressed', DR_MODEL.isTableOn(table) ? 'true' : 'false');
}

/** @param {Element} table The table whose table pillbox this removes. */
function removeTablePillbox(table) {
  const view = tablePillboxViews.get(table);
  if (!view) return;
  if (view.button.parentElement) {
    view.button.parentElement.removeChild(view.button);
  }
  view.anchor.styleObserver.disconnect();
  table.style.anchorName = view.anchor.priorAnchorName;
  tablePillboxViews.delete(table);
}

// Every settings write targets the active table, so on each settings notice
// this subscriber redraws the active table's table pillbox. It runs before the
// controller applies the written settings.
DR_BUS.subscribe('state:settingsChanged', () => {
  const active = DR_MODEL.getActiveTable();
  if (active) syncTablePillbox(active);
});

let tablePillboxStyleInjected = false;
function ensureTablePillboxStyleInjected() {
  if (tablePillboxStyleInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .dr-ext-table-pillbox {
      position: fixed;
      position-visibility: anchors-visible;
      left: calc(anchor(right, ${TABLE_PILLBOX_NO_ANCHOR_PX}px) + ${TABLE_PILLBOX_OFFSET_X_PX}px);
      top: calc(anchor(top, ${TABLE_PILLBOX_NO_ANCHOR_PX}px) + ${TABLE_PILLBOX_OFFSET_Y_PX}px);
      z-index: 2147483646;
      display: inline-flex;
      justify-content: flex-end;
      align-items: flex-start;
      padding: ${TABLE_PILLBOX_HIT_PAD_PX}px;
      background: transparent;
      border: 0;
      cursor: pointer;
      vertical-align: top;
      -webkit-tap-highlight-color: transparent;
    }
    .dr-ext-table-pillbox-dot {
      position: relative;
      display: block;
      width: ${TABLE_PILLBOX_DOT_PX}px;
      height: ${TABLE_PILLBOX_DOT_PX}px;
      border-radius: 50%;
      background: ${TABLE_PILLBOX_COLOR_OFF};
      transition: width .18s ease, height .18s ease, border-radius .18s ease, background .2s ease;
    }
    .dr-ext-table-pillbox[aria-pressed="true"] .dr-ext-table-pillbox-dot {
      background: ${TABLE_PILLBOX_COLOR_ON};
    }
    .dr-ext-table-pillbox-knob {
      position: absolute;
      top: 50%;
      left: ${TABLE_PILLBOX_KNOB_INSET_PX}px;
      transform: translateY(-50%);
      width: ${TABLE_PILLBOX_KNOB_PX}px;
      height: ${TABLE_PILLBOX_KNOB_PX}px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,.35);
      opacity: 0;
      transition: opacity .12s ease, left .2s ease;
    }
    .dr-ext-table-pillbox.expanded .dr-ext-table-pillbox-dot,
    .dr-ext-table-pillbox:focus-visible .dr-ext-table-pillbox-dot {
      width: ${TABLE_PILLBOX_PILL_WIDTH_PX}px;
      height: ${TABLE_PILLBOX_PILL_HEIGHT_PX}px;
      border-radius: 999px;
    }
    .dr-ext-table-pillbox.expanded .dr-ext-table-pillbox-knob,
    .dr-ext-table-pillbox:focus-visible .dr-ext-table-pillbox-knob {
      opacity: 1;
    }
    .dr-ext-table-pillbox.expanded[aria-pressed="true"] .dr-ext-table-pillbox-knob,
    .dr-ext-table-pillbox:focus-visible[aria-pressed="true"] .dr-ext-table-pillbox-knob {
      left: ${TABLE_PILLBOX_KNOB_INSET_PX + TABLE_PILLBOX_KNOB_TRAVEL_PX}px;
    }
    @media (hover: hover) and (pointer: fine) {
      .dr-ext-table-pillbox:hover .dr-ext-table-pillbox-dot {
        width: ${TABLE_PILLBOX_PILL_WIDTH_PX}px;
        height: ${TABLE_PILLBOX_PILL_HEIGHT_PX}px;
        border-radius: 999px;
      }
      .dr-ext-table-pillbox:hover .dr-ext-table-pillbox-knob {
        opacity: 1;
      }
      .dr-ext-table-pillbox:hover[aria-pressed="true"] .dr-ext-table-pillbox-knob {
        left: ${TABLE_PILLBOX_KNOB_INSET_PX + TABLE_PILLBOX_KNOB_TRAVEL_PX}px;
      }
    }
    .dr-ext-table-pillbox:focus-visible { outline: 2px solid ${TABLE_PILLBOX_COLOR_ON}!important; outline-offset: 2px; }
  `;
  (document.head || document.documentElement).appendChild(style);
  tablePillboxStyleInjected = true;
}

function windowScrollOffset() {
  return {
    x: window.scrollX || 0,
    y: window.scrollY || 0,
  };
}

function anchorNameList(value) {
  if (!value || value === 'none') return [];
  return value.split(',').map((n) => n.trim()).filter(Boolean);
}

function withoutViewAnchorNames(names) {
  return names.filter((n) => !n.startsWith(TABLE_PILLBOX_ANCHOR_PREFIX));
}

// The page's own anchor names, from its stylesheet or its inline style, stay
// first in the list, so an element the page anchors to the table stays in
// place. The list leaves out every name the view wrote earlier, including a
// name a copied table carries from its original: two elements with one name
// would anchor the original's table pillbox to the copy.
//
// The view writes the list inline once. A stylesheet rule that changes the
// table's anchor name later, on a class change or a media query, does not
// reach the table while the table pillbox is on it.
function writeTableAnchorName(table, name) {
  const pageNames = withoutViewAnchorNames(anchorNameList(window.getComputedStyle(table).anchorName));
  table.style.anchorName = pageNames.concat(name).join(', ');
}

// The browser keeps the table pillbox on its table's top-right corner through
// every scroll and every layout change, so no script moves it. position: fixed
// matters: a fixed element can anchor to a table inside a box the page pins to
// the window, where an absolutely positioned one cannot. position-visibility
// hides the table pillbox while page areas cut off the whole table. Chrome's
// default for it has changed between versions, so the rule sets it.
//
// A page that rewrites the table's whole style attribute drops the anchor
// name, and the table pillbox would leave the table for good. The style
// observer writes the name again, and records the page's new inline value as
// the one to restore.
function anchorTablePillbox(table, button) {
  const name = TABLE_PILLBOX_ANCHOR_PREFIX + TABLE_PILLBOX_ANCHOR_LOAD + '-' + (++tablePillboxAnchorCount);
  const anchor = {
    name,
    priorAnchorName: withoutViewAnchorNames(anchorNameList(table.style.anchorName)).join(', '),
    styleObserver: null,
  };
  writeTableAnchorName(table, name);
  button.style.positionAnchor = name;
  anchor.styleObserver = new MutationObserver(() => {
    const inlineNames = anchorNameList(table.style.anchorName);
    if (inlineNames.includes(name)) return;
    anchor.priorAnchorName = withoutViewAnchorNames(inlineNames).join(', ');
    writeTableAnchorName(table, name);
  });
  anchor.styleObserver.observe(table, { attributes: true, attributeFilter: ['style'] });
  return anchor;
}

/** Guard so the global tap-outside collapse listener is added only once */
let _globalTapCollapseAdded = false;

function createTablePillbox(table) {
  ensureTablePillboxStyleInjected();

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dr-ext-table-pillbox';
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', 'Simplify table');

  const dot = document.createElement('span');
  dot.className = 'dr-ext-table-pillbox-dot';

  const knob = document.createElement('span');
  knob.className = 'dr-ext-table-pillbox-knob';

  dot.appendChild(knob);
  button.appendChild(dot);

  const anchor = anchorTablePillbox(table, button);
  (document.body || document.documentElement).appendChild(button);

  let pointerType = '';
  button.addEventListener('pointerdown', (e) => {
    pointerType = e.pointerType || '';
  });

  let _touchPenCollapseTimer = null;

  function scheduleAutoCollapse() {
    if (_touchPenCollapseTimer !== null) clearTimeout(_touchPenCollapseTimer);
    _touchPenCollapseTimer = setTimeout(() => {
      button.classList.remove('expanded');
      _touchPenCollapseTimer = null;
    }, TABLE_PILLBOX_AUTO_COLLAPSE_MS);
  }

  // Mouse and keyboard press at once; touch and pen expand on the first tap and
  // press on the second. On a press this handler publishes intent:toggleTable
  // and calls nothing else. The controller in content.js runs the shape check
  // and then the press. This view holds only the expand and collapse state.
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pointerType === 'touch' || pointerType === 'pen') {
      if (!button.classList.contains('expanded')) {
        button.classList.add('expanded');
      } else {
        DR_BUS.publish('intent:toggleTable', { table });
      }
      scheduleAutoCollapse();
    } else {
      DR_BUS.publish('intent:toggleTable', { table });
    }
  });

  button.addEventListener('keydown', (e) => {
    // The browser fires a click on the button on Enter, so a click call here would press twice.
    if (e.key === 'Enter') e.stopPropagation();
  });

  button.addEventListener('mousedown', (e) => e.stopPropagation());

  tablePillboxViews.set(table, { button, anchor });

  // Global tap-outside collapse (added once for all table pillboxes)
  if (!_globalTapCollapseAdded) {
    _globalTapCollapseAdded = true;
    document.addEventListener('pointerdown', (e) => {
      document.querySelectorAll('.dr-ext-table-pillbox.expanded').forEach((btn) => {
        if (!btn.contains(e.target)) {
          btn.classList.remove('expanded');
        }
      });
    });
  }

  return button;
}

let highlightStyleInjected = false;
function ensureHighlightStyleInjected() {
  if (highlightStyleInjected) return;
  const style = document.createElement('style');
  // The whole-table outline sits inside the table's edge: a page box that
  // cuts off its content at the table's edge, such as a chat page's table
  // card, would cut off an outline drawn outside it.
  style.textContent = `
    @keyframes drExtActiveFlash {
      0%   { outline: 2px solid rgba(66, 133, 244, 0.95); outline-offset: -2px; }
      100% { outline: 2px solid rgba(66, 133, 244, 0);    outline-offset: -2px; }
    }
    .dr-ext-active-flash {
      animation: drExtActiveFlash 1s ease-out;
    }
    @keyframes drExtRangePulse {
      0%   { border-color: rgba(255,255,255,0.0);  box-shadow: 0 0 0 2px rgba(66,133,244,0.0); }
      25%  { border-color: rgba(255,255,255,0.55); box-shadow: 0 0 0 2px rgba(66,133,244,0.6); }
      50%  { border-color: rgba(255,255,255,0.0);  box-shadow: 0 0 0 2px rgba(66,133,244,0.0); }
      75%  { border-color: rgba(255,255,255,0.55); box-shadow: 0 0 0 2px rgba(66,133,244,0.6); }
      100% { border-color: rgba(255,255,255,0.0);  box-shadow: 0 0 0 2px rgba(66,133,244,0.0); }
    }
    .dr-ext-range-pulse {
      position: absolute;
      pointer-events: none;
      z-index: 2147483647;
      border: 2px solid rgba(255,255,255,0.0);
      border-radius: 2px;
      box-sizing: border-box;
      animation: drExtRangePulse 0.6s ease-in-out 2;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
  highlightStyleInjected = true;
}

function flashActiveTable(table) {
  ensureHighlightStyleInjected();
  table.classList.remove('dr-ext-active-flash');
  // Force reflow so the animation restarts when re-added.
  void table.offsetWidth;
  table.classList.add('dr-ext-active-flash');
}

/**
 * Pulse a faint blue-and-white border around the range expression's cells.
 * - If ranges is null (a blank or invalid range expression), shows the whole-table outline flash.
 * - If ranges is an array, overlays an absolutely positioned div sized to the bounding
 *   rectangle of the range expression's cells, and removes it after the animation ends (about 1.2 seconds).
 *   The div goes in document.body so it never wraps or alters td elements.
 *
 * Cells come from the TableAdapter (makeAdapter), because table.rows and
 * row.cells exist only on native tables.
 */
function flashRangePulse(table, ranges) {
  ensureHighlightStyleInjected();
  if (!ranges) {
    flashActiveTable(table);
    return;
  }

  const adapterRows = makeAdapter(table).getRows();
  const matchedCells = [];
  for (let r = 0; r < adapterRows.length; r++) {
    const cells = adapterRows[r].getCells();
    for (let c = 0; c < cells.length; c++) {
      // The cell's grid column, the same number the engine gates on, so the
      // pulse frames the cells the range actually rounds even where a merge
      // moves a cell away from its position in the row read.
      if (isInRanges(r, cells[c].columnIndex, ranges)) {
        matchedCells.push(cells[c].el);
      }
    }
  }

  if (matchedCells.length === 0) {
    // No cells matched (e.g. range outside table bounds) — fall back to whole-table flash.
    flashActiveTable(table);
    return;
  }

  let top = Infinity, left = Infinity, bottom = -Infinity, right = -Infinity;
  for (const cell of matchedCells) {
    const rect = cell.getBoundingClientRect();
    if (rect.top    < top)    top    = rect.top;
    if (rect.left   < left)   left   = rect.left;
    if (rect.bottom > bottom) bottom = rect.bottom;
    if (rect.right  > right)  right  = rect.right;
  }

  // Convert to absolute page coordinates so the overlay stays put on scrollable pages.
  const { x: scrollX, y: scrollY } = windowScrollOffset();
  const absTop    = top    + scrollY;
  const absLeft   = left   + scrollX;
  const absWidth  = right  - left;
  const absHeight = bottom - top;

  const overlay = document.createElement('div');
  overlay.className = 'dr-ext-range-pulse';
  overlay.style.top    = absTop    + 'px';
  overlay.style.left   = absLeft   + 'px';
  overlay.style.width  = absWidth  + 'px';
  overlay.style.height = absHeight + 'px';

  // The timeout removes the overlay when animationend never fires.
  const cleanup = () => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };
  overlay.addEventListener('animationend', cleanup);
  setTimeout(cleanup, PULSE_CLEANUP_MS);

  (document.body || document.documentElement).appendChild(overlay);
}
