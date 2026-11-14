/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * The table pillbox view: the table pillbox's geometry, styles, creation and
 * positioning, and the flash and pulse highlights.
 *
 * Module-level state here is drawing state only: button elements, resize
 * observers, and once-only flags. The registry and the active table are held
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
// isTablePillboxSpotClipped reads one style per ancestor on every reposition,
// so this cap bounds that cost per table. Real pages nest a table well under
// 100 ancestors deep. Ancestors past the cap count as cutting off nothing.
const TABLE_PILLBOX_CLIP_WALK_CAP = 100;
// Overflow values that cut off an element's content at its box.
const CLIPPING_OVERFLOW = new Set(['hidden', 'scroll', 'auto', 'clip']);

// --- Per-table pillbox infrastructure ---

// A table (native or grid) → { button, resizeObserver }.
const tablePillboxViews = new WeakMap();

// The table pillbox shows the table's on/off value, the same value the
// sidebar pillbox shows, so the two always agree. The press handler in
// content.js reads this value and writes its opposite. A table that is on
// with no cell to simplify still shows on.
function isTableOn(table) {
  return DR_MODEL.getTableSettings(table).enabled === true;
}

function syncTablePillbox(table) {
  const view = tablePillboxViews.get(table);
  if (!view) return;
  view.button.setAttribute('aria-pressed', isTableOn(table) ? 'true' : 'false');
}

/** @param {Element} table The table whose table pillbox this removes. */
function removeTablePillbox(table) {
  const view = tablePillboxViews.get(table);
  if (!view) return;
  if (view.button.parentElement) {
    view.button.parentElement.removeChild(view.button);
  }
  view.resizeObserver.disconnect();
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
      position: absolute;
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

// The table pillbox sits in the page body, outside every page area, so the
// positioning hides it while its spot is out of a page area's view.
// isTablePillboxSpotClipped returns true when the point (x, y), in
// window coordinates, sits outside the box of an ancestor that cuts off its
// content on that axis. The walk stops at the page body, whose overflow the
// window scroll covers, and at TABLE_PILLBOX_CLIP_WALK_CAP ancestors.
function isTablePillboxSpotClipped(table, x, y) {
  let el = table.parentElement;
  for (let i = 0; el && el !== document.body && i < TABLE_PILLBOX_CLIP_WALK_CAP; i++) {
    const style = window.getComputedStyle(el);
    const clipsX = CLIPPING_OVERFLOW.has(style.overflowX);
    const clipsY = CLIPPING_OVERFLOW.has(style.overflowY);
    if (clipsX || clipsY) {
      const box = el.getBoundingClientRect();
      if (clipsX && (x < box.left || x > box.right)) return true;
      if (clipsY && (y < box.top || y > box.bottom)) return true;
    }
    el = el.parentElement;
  }
  return false;
}

function windowScrollOffset() {
  return {
    x: window.scrollX || window.pageXOffset || 0,
    y: window.scrollY || window.pageYOffset || 0,
  };
}

function positionTablePillbox(table, button) {
  const rect = table.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(table);
  // The centre of the dot, which sits over the table's top-right corner.
  const spotX = rect.right + TABLE_PILLBOX_DOT_OVERHANG_PX - TABLE_PILLBOX_DOT_PX / 2;
  const spotY = rect.top + TABLE_PILLBOX_DOT_OVERLAP_PX - TABLE_PILLBOX_DOT_PX / 2;
  if (
    (rect.width === 0 && rect.height === 0) ||
    computedStyle.display === 'none' ||
    computedStyle.visibility === 'hidden' ||
    isTablePillboxSpotClipped(table, spotX, spotY)
  ) {
    button.style.display = 'none';
    return;
  }
  button.style.display = '';
  const { x: scrollX, y: scrollY } = windowScrollOffset();
  // Position so the dot's bottom = rect.top + scrollY + TABLE_PILLBOX_DOT_OVERLAP_PX
  // and the dot's right = rect.right + scrollX + TABLE_PILLBOX_DOT_OVERHANG_PX.
  // The button has TABLE_PILLBOX_HIT_PAD_PX padding on every side; with flex-end /
  // flex-start the dot sits inside the button's content box, so its right
  // edge is button.right - padding (not button.right). One padding subtracts
  // from each axis — there is no double-padding term.
  const padding = TABLE_PILLBOX_HIT_PAD_PX;
  const buttonLeft = (rect.right + scrollX + TABLE_PILLBOX_DOT_OVERHANG_PX) - TABLE_PILLBOX_DOT_PX - padding;
  const buttonTop  = (rect.top   + scrollY + TABLE_PILLBOX_DOT_OVERLAP_PX)  - TABLE_PILLBOX_DOT_PX - padding;
  button.style.left = buttonLeft + 'px';
  button.style.top  = buttonTop  + 'px';
}

// The recorded and the compared fingerprint both read the stored originals, so
// the extension's own writes never read as a page change.
/** @param {Element} table The registered table whose stored originals the reader returns. */
function fingerprintReadOpts(table) {
  return { originalText: (cellEl) => DR_MODEL.getTableOriginalText(table, cellEl) };
}

/** Guard so the global tap-outside collapse listener is added only once */
let _globalTapCollapseAdded = false;

function createTablePillbox(table) {
  if (!isDataTable(table)) return;
  if (table.tagName !== 'TABLE') table.classList.add('dr-ext-grid');
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

  (document.body || document.documentElement).appendChild(button);

  setTimeout(() => {
    positionTablePillbox(table, button);
  }, 150);

  button.addEventListener('pointerdown', (e) => {
    button.dataset.pointerType = e.pointerType || '';
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
    const pType = button.dataset.pointerType;
    if (pType === 'touch' || pType === 'pen') {
      if (!button.classList.contains('expanded')) {
        button.classList.add('expanded');
        scheduleAutoCollapse();
      } else {
        DR_BUS.publish('intent:toggleTable', { table });
        scheduleAutoCollapse();
      }
    } else {
      DR_BUS.publish('intent:toggleTable', { table });
    }
  });

  button.addEventListener('keydown', (e) => {
    // The browser fires a click on the button on Enter, so a click call here would press twice.
    if (e.key === 'Enter') e.stopPropagation();
  });

  button.addEventListener('mousedown', (e) => e.stopPropagation());

  const resizeObserver = new ResizeObserver(() => {
    positionTablePillbox(table, button);
  });
  resizeObserver.observe(table);

  // View-only bookkeeping. DR_MODEL's table registry holds the "found"
  // registration, and repositioning walks it.
  tablePillboxViews.set(table, { button, resizeObserver });
  DR_MODEL.registerTable(table);
  // The shape fingerprint, recorded once per registration. A new registry
  // entry holds no originals, so this read takes the cells as they stand.
  DR_MODEL.setTableFingerprint(table, readTableFingerprint(table, fingerprintReadOpts(table)));

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

// The page observer in content.js passes each added element. The nomination
// outcomes go to consumeNominations in content.js, which holds each pending
// table, so content.js calls this only after it defines consumeNominations.
/** @param {Document|Element} [root] The node whose subtree the scan reads. */
function injectTablePillboxes(root = document) {
  const { tables, nominations } = scanTables(root, { isRegistered: DR_MODEL.hasTable });
  tables.forEach(table => {
    if (!DR_MODEL.hasTable(table)) {
      createTablePillbox(table);
    }
  });
  // For a grid the nomination step selected, createTablePillbox runs the data
  // test a second time. The repeat keeps registration in this view alone.
  consumeNominations(nominations);
}

// A settings write can register a table that has no table pillbox, so the
// walk skips a registered table with no button.
function repositionAllTablePillboxes() {
  for (const table of DR_MODEL.getRegisteredTables()) {
    const view = tablePillboxViews.get(table);
    if (view) {
      positionTablePillbox(table, view.button);
    }
  }
}

// Reposition every table pillbox on scroll/resize. A scroll event fires on the
// element that scrolled and does not bubble, so the scroll listener runs in
// the capture phase: it runs on a page area's scroll as well as the window's.
// The browser fires at most one scroll event per scrolling element per frame.
let _scrollResizeListenersAdded = false;
function ensureScrollResizeListeners() {
  if (_scrollResizeListenersAdded) return;
  _scrollResizeListenersAdded = true;
  window.addEventListener('scroll', repositionAllTablePillboxes, { capture: true, passive: true });
  window.addEventListener('resize', repositionAllTablePillboxes, { passive: true });
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
  setTimeout(cleanup, 1500);

  (document.body || document.documentElement).appendChild(overlay);
}
