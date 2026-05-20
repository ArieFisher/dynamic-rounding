/**
 * DynamicRounding Chrome Extension
 * Version: 1.6.0
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

// Constants
const CLEAN_REGEX = /[$€£¥,\s%]/g;
const PARENS_REGEX = /^\((.+)\)$/;
const NUMBER_IN_TEXT_REGEX = /-?\d[\d,]*(?:\.\d+)?/;
const NUMBER_IN_TEXT_REGEX_GLOBAL = /-?\d[\d,]*(?:\.\d+)?/g;
const DEFAULT_OFFSET_TOP = -0.5;
const DEFAULT_NUM_TOP = 1;
const VALIDATION_LIMIT = 20;
const EPSILON = 1e-9;

const DEFAULT_SIDEBAR_OPTIONS = {
  enabled: true,
  excludeWords: true,
  excludeDates: true,
  excludeTimes: true,
  excludeFirstColumn: true,
  excludePercent: false,
  excludeCurrency: false,
  dateGranularity: 'year',     // year | decade | century
  timeGranularity: 'minute',   // minute | hour
  offsetTop: null,             // null = use DEFAULT_OFFSET_TOP
  offsetOther: null,           // null = inherit from offsetTop
  numTop: null                 // null = use DEFAULT_NUM_TOP
};

let lastRightClickedElement = null;
let lastRightClickedTable = null;

document.addEventListener('contextmenu', (event) => {
  lastRightClickedElement = event.target;
  const table = event.target.closest && event.target.closest('table');
  if (table) {
    lastRightClickedTable = table;
  }
}, true);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'MENU_CLICKED') {
    if (lastRightClickedElement) {
      const table = lastRightClickedElement.closest('table');
      if (table) {
        if (!table.querySelector('.dr-ext-rounded')) {
          roundTable(table);
          chrome.runtime.sendMessage({ action: 'UPDATE_MENU_LABEL', title: 'Show original values' });
        } else {
          toggleOriginalValues(table);
          const label = table.dataset.drShowingOriginal === 'true' ? 'Show rounded values' : 'Show original values';
          chrome.runtime.sendMessage({ action: 'UPDATE_MENU_LABEL', title: label });
        }
      } else {
        console.debug("Dynamic Rounding: No table found at right-click location.");
      }
    }
    return;
  }

  if (request.action === 'SIDEBAR_OPENED') {
    if (lastRightClickedTable) {
      applySidebarRounding(lastRightClickedTable, DEFAULT_SIDEBAR_OPTIONS);
    } else {
      console.debug("Dynamic Rounding: No table targeted. Right-click a table cell first.");
    }
    return;
  }

  if (request.action === 'APPLY_SIDEBAR_SETTINGS') {
    if (lastRightClickedTable) {
      applySidebarRounding(lastRightClickedTable, request.settings || DEFAULT_SIDEBAR_OPTIONS);
    }
    return;
  }
});

window.addEventListener('pagehide', () => {
  try {
    chrome.runtime.sendMessage({ action: 'PAGE_UNLOADED' });
  } catch (e) {
    // extension context may already be gone
  }
});

function applySidebarRounding(table, options) {
  const opts = Object.assign({}, DEFAULT_SIDEBAR_OPTIONS, options || {});
  ensureHighlightStyleInjected();
  resetTable(table);
  if (opts.enabled !== false) {
    roundTable(table, opts);
    if (table.querySelector('.dr-ext-rounded')) {
      chrome.runtime.sendMessage({ action: 'UPDATE_MENU_LABEL', title: 'Show original values' });
    }
  } else {
    chrome.runtime.sendMessage({ action: 'UPDATE_MENU_LABEL', title: 'Round table dynamically' });
  }
  flashTargetedTable(table);
}

let highlightStyleInjected = false;
function ensureHighlightStyleInjected() {
  if (highlightStyleInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes drExtTargetFlash {
      0%   { outline: 2px solid rgba(66, 133, 244, 0.95); outline-offset: 2px; }
      100% { outline: 2px solid rgba(66, 133, 244, 0);    outline-offset: 2px; }
    }
    .dr-ext-target-flash {
      animation: drExtTargetFlash 1s ease-out;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
  highlightStyleInjected = true;
}

function flashTargetedTable(table) {
  table.classList.remove('dr-ext-target-flash');
  // Force reflow so the animation restarts when re-added.
  void table.offsetWidth;
  table.classList.add('dr-ext-target-flash');
}

function resetTable(table) {
  const roundedCells = table.querySelectorAll('.dr-ext-rounded');
  const showingOriginal = table.dataset.drShowingOriginal === 'true';
  for (const cell of roundedCells) {
    const original = cell.dataset.originalValue;
    const rounded = cell.dataset.roundedValue;
    if (original && rounded) {
      const shown = showingOriginal ? original : rounded;
      replaceTextPreservingHTML(cell, shown, original);
    }
    cell.classList.remove('dr-ext-rounded');
    delete cell.dataset.originalValue;
    delete cell.dataset.roundedValue;
    cell.removeAttribute('title');
  }
  delete table.dataset.drShowingOriginal;
}

function roundTable(table, options) {
  const opts = Object.assign({}, DEFAULT_SIDEBAR_OPTIONS, options || {});
  const offsetTop = resolveOffset(opts.offsetTop, DEFAULT_OFFSET_TOP);
  const offsetOther = resolveOffset(opts.offsetOther, offsetTop);
  const numTop = resolveNumTop(opts.numTop, DEFAULT_NUM_TOP);
  const rows = Array.from(table.rows);
  const data = [];
  const cellsMap = [];
  const cellInfo = [];

  for (let r = 0; r < rows.length; r++) {
    const cells = Array.from(rows[r].cells);
    const rowData = [];
    const rowCells = [];
    const rowInfo = [];
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];
      const text = cell.innerText || cell.textContent;
      rowData.push(text);
      rowCells.push(cell);

      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (getExclusionReason(text, c, opts)) {
        rowInfo.push({ mode: 'skip' });
      } else if (opts.excludeDates === false && isDateLike(trimmed)) {
        rowInfo.push({ mode: 'date' });
      } else if (opts.excludeTimes === false && isTimeLike(trimmed)) {
        rowInfo.push({ mode: 'time' });
      } else {
        const num = toNumber(text);
        if (num !== null) {
          rowInfo.push({ mode: 'pure', num });
        } else if (!opts.excludeWords) {
          const matches = extractNumbersInText(text);
          if (matches.length > 0) {
            rowInfo.push({ mode: 'extracted', matches });
          } else {
            rowInfo.push({ mode: 'skip' });
          }
        } else {
          rowInfo.push({ mode: 'skip' });
        }
      }
    }
    data.push(rowData);
    cellsMap.push(rowCells);
    cellInfo.push(rowInfo);
  }

  const allNums = [];
  for (const row of cellInfo) {
    for (const info of row) {
      if (info.mode === 'pure') allNums.push(info.num);
      else if (info.mode === 'extracted') {
        for (const m of info.matches) allNums.push(m.num);
      }
    }
  }
  const max_mag = findMaxMagnitude([allNums]);

  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      const info = cellInfo[r][c];
      if (info.mode === 'skip') continue;

      const originalValue = data[r][c];
      const cell = cellsMap[r][c];
      let formattedValue;

      if (info.mode === 'date') {
        formattedValue = roundDateText(originalValue, opts.dateGranularity);
        if (formattedValue === null || formattedValue === originalValue) continue;
      } else if (info.mode === 'time') {
        formattedValue = roundTimeText(originalValue, opts.timeGranularity);
        if (formattedValue === null || formattedValue === originalValue) continue;
      } else if (info.mode === 'pure') {
        const roundedValue = roundCellSetAware(info.num, info.num, max_mag, offsetTop, offsetOther, numTop);
        if (roundedValue === info.num) continue;
        formattedValue = restoreFormatting(roundedValue, originalValue);
      } else {
        // Round each match individually, splice back from right-to-left so earlier indices remain valid.
        let changed = false;
        formattedValue = originalValue;
        for (let i = info.matches.length - 1; i >= 0; i--) {
          const m = info.matches[i];
          const rounded = roundCellSetAware(m.num, m.num, max_mag, offsetTop, offsetOther, numTop);
          if (rounded === m.num) continue;
          const newNum = formatExtractedNumber(rounded, m.numStr);
          formattedValue = formattedValue.substring(0, m.index) + newNum + formattedValue.substring(m.index + m.numStr.length);
          changed = true;
        }
        if (!changed) continue;
      }

      replaceTextPreservingHTML(cell, originalValue, formattedValue);
      cell.title = `Original: ${originalValue}`;
      cell.classList.add('dr-ext-rounded');
      cell.dataset.originalValue = originalValue;
      cell.dataset.roundedValue = formattedValue;
    }
  }
}

function resolveOffset(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!isFinite(num)) return fallback;
  if (num < -VALIDATION_LIMIT || num > VALIDATION_LIMIT) return fallback;
  return num;
}

function resolveNumTop(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'number' ? value : parseInt(value, 10);
  if (!isFinite(num) || num < 1) return fallback;
  return Math.floor(num);
}

function getExclusionReason(text, columnIndex, options) {
  if (options.excludeFirstColumn && columnIndex === 0) return 'firstColumn';
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (options.excludeDates && isDateLike(t)) return 'dates';
  if (options.excludeTimes && isTimeLike(t)) return 'times';
  if (options.excludePercent && /%/.test(t)) return 'percent';
  if (options.excludeCurrency && /[$€£¥₹]/.test(t)) return 'currency';
  return null;
}

function isYearValue(text) {
  if (!/^\d{4}$/.test(text)) return false;
  const n = parseInt(text, 10);
  return n >= 1900 && n <= 2099;
}

const MONTH_NAMES = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const DATE_REGEXES = [
  /^\d{4}-\d{2}-\d{2}$/,                              // 2024-03-14
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,                      // 3/14/2024
  /^\d{1,2}-\d{1,2}-\d{2,4}$/,                        // 3-14-2024
  new RegExp(`^${MONTH_NAMES}\\s+\\d{1,2},?\\s+\\d{4}$`, 'i'),  // March 14, 2024
  new RegExp(`^\\d{1,2}\\s+${MONTH_NAMES}\\s+\\d{4}$`, 'i'),    // 14 March 2024
  new RegExp(`^${MONTH_NAMES}\\s+\\d{4}$`, 'i'),               // March 2024
  new RegExp(`^\\d{1,2}\\s+${MONTH_NAMES}$`, 'i')              // 14 March
];

function isDateLike(text) {
  if (isYearValue(text)) return true;
  for (const re of DATE_REGEXES) {
    if (re.test(text)) return true;
  }
  return false;
}

function isTimeLike(text) {
  // HH:MM or HH:MM:SS, optional AM/PM
  return /^\d{1,2}:\d{2}(:\d{2})?(\s*[ap]\.?m\.?)?$/i.test(text);
}

function roundDateText(text, granularity) {
  if (typeof text !== 'string') return null;
  if (granularity === 'year' || !granularity) return null; // no change at year granularity
  const yearMatch = text.match(/\b(19\d{2}|20\d{2})\b/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1], 10);
  let rounded;
  if (granularity === 'decade') rounded = Math.floor(year / 10) * 10;
  else if (granularity === 'century') rounded = Math.floor(year / 100) * 100;
  else return null;
  if (rounded === year) return null;
  return text.substring(0, yearMatch.index) + String(rounded) + text.substring(yearMatch.index + yearMatch[1].length);
}

function roundTimeText(text, granularity) {
  if (typeof text !== 'string') return null;
  if (granularity === 'minute' || !granularity) return null;
  if (granularity !== 'hour') return null;
  const trimmed = text.trim();
  const m = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(\s*[ap]\.?m\.?)?$/i);
  if (!m) return null;
  const origHourStr = m[1];
  const origHour = parseInt(origHourStr, 10);
  const minutes = parseInt(m[2], 10);
  const seconds = m[3] ? parseInt(m[3], 10) : 0;
  const ampmRaw = m[4] || '';
  const has12HourSuffix = ampmRaw !== '';
  const isPm = has12HourSuffix && /p/i.test(ampmRaw);

  // Round up if at or past the half-hour mark.
  const roundUp = minutes > 30 || (minutes === 30 && seconds >= 0) || (minutes === 29 && seconds >= 30);

  let hour24;
  if (has12HourSuffix) {
    // 12-hour clock: 12 AM = 0, 1-11 AM = 1-11, 12 PM = 12, 1-11 PM = 13-23.
    hour24 = (origHour % 12) + (isPm ? 12 : 0);
  } else {
    hour24 = origHour;
  }
  if (roundUp) hour24 = (hour24 + 1) % 24;
  else hour24 = hour24 % 24;

  let displayHour;
  let displayAmpm = '';
  if (has12HourSuffix) {
    const newIsPm = hour24 >= 12;
    let h12 = hour24 % 12;
    if (h12 === 0) h12 = 12;
    displayHour = String(h12);
    // Preserve the original AM/PM token style ("AM", "am", "a.m.", " PM", etc.)
    // by swapping the a/p letter but keeping the rest of the original suffix.
    displayAmpm = newIsPm ? ampmRaw.replace(/a/i, c => c === 'A' ? 'P' : 'p')
                          : ampmRaw.replace(/p/i, c => c === 'P' ? 'A' : 'a');
  } else {
    displayHour = origHourStr.length === 2
      ? String(hour24).padStart(2, '0')
      : String(hour24);
  }

  let result = `${displayHour}:00`;
  if (m[3]) result += ':00';
  result += displayAmpm;
  return result === trimmed ? null : result;
}

function extractNumberInText(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(NUMBER_IN_TEXT_REGEX);
  if (!match) return null;
  const numStr = match[0];
  const num = toNumber(numStr);
  if (num === null || num === 0) return null;
  return { numStr, num, index: match.index };
}

function extractNumbersInText(text) {
  if (typeof text !== 'string') return [];
  const matches = [];
  const re = new RegExp(NUMBER_IN_TEXT_REGEX_GLOBAL.source, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const num = toNumber(m[0]);
    if (num !== null && num !== 0) {
      matches.push({ numStr: m[0], num, index: m.index });
    }
  }
  return matches;
}

function formatExtractedNumber(rounded, originalNumStr) {
  const hasCommas = originalNumStr.includes(',');
  const decMatch = originalNumStr.match(/\.(\d+)/);
  let decimals = decMatch ? decMatch[1].length : 0;
  if (Math.abs(rounded) >= 10) decimals = 0;
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.max(decimals, 10),
    useGrouping: hasCommas
  });
}

function toggleOriginalValues(table) {
  const roundedCells = table.querySelectorAll('.dr-ext-rounded');
  if (roundedCells.length === 0) return;

  const showingOriginal = table.dataset.drShowingOriginal === 'true';

  for (const cell of roundedCells) {
    const original = cell.dataset.originalValue;
    const rounded = cell.dataset.roundedValue;
    if (!original || !rounded) continue;

    if (showingOriginal) {
      replaceTextPreservingHTML(cell, original, rounded);
      cell.title = `Original: ${original}`;
    } else {
      replaceTextPreservingHTML(cell, rounded, original);
      cell.title = `Rounded: ${rounded}`;
    }
  }

  table.dataset.drShowingOriginal = showingOriginal ? 'false' : 'true';
}

// --- Core Algorithm Inlined ---

function ROUND_DYNAMIC(values, offset_top, offset_other, num_top) {
  const firstIsArray = Array.isArray(values);

  if (firstIsArray) {
    return datasetMode(values, offset_top, offset_other, num_top);
  } else {
    return singleValueMode(values, offset_top);
  }
}

function singleValueMode(value, offset) {
  offset = (offset === undefined || offset === "") ? DEFAULT_OFFSET_TOP : offset;
  validateOffset(offset, "offset");

  if (value === "" || value === null) return "";

  const num = toNumber(value);
  if (num === null) return value;
  if (num === 0) return 0;

  return roundWithOffset(num, offset);
}

function datasetMode(range, offset_top, offset_other, num_top) {
  offset_top = (offset_top === undefined || offset_top === "") ? DEFAULT_OFFSET_TOP : offset_top;
  offset_other = (offset_other === undefined || offset_other === "") ? offset_top : offset_other;
  num_top = (num_top === undefined || num_top === "") ? DEFAULT_NUM_TOP : num_top;
  validateOffset(offset_top, "offset_top");
  validateOffset(offset_other, "offset_other");

  if (!Array.isArray(range[0])) {
    range = [range];
  }

  const numericRange = range.map(row => row.map(cell => toNumber(cell)));
  const max_mag = findMaxMagnitude(numericRange);

  return range.map((row, r) =>
    row.map((cell, c) => roundCellSetAware(cell, numericRange[r][c], max_mag, offset_top, offset_other, num_top))
  );
}

function findMaxMagnitude(numericRange) {
  let max_mag = null;
  for (let row of numericRange) {
    for (let num of row) {
      if (num !== null && num !== 0 && isFinite(num)) {
        const mag = Math.floor(Math.log10(Math.abs(num)));
        if (max_mag === null || mag > max_mag) {
          max_mag = mag;
        }
      }
    }
  }
  return max_mag;
}

function roundCellSetAware(value, num, max_mag, offset_top, offset_other, num_top) {
  if (value === "" || value === null) return "";

  if (num === null) return value;
  if (num === 0) return 0;

  const current_mag = Math.floor(Math.log10(Math.abs(num)));

  let offset = offset_other;
  if (max_mag !== null && (max_mag - current_mag) < num_top) {
    offset = offset_top;
  }

  return roundWithOffset(num, offset);
}

function roundWithOffset(num, offset) {
  const current_mag = Math.floor(Math.log10(Math.abs(num)));

  const oom_offset = Math.trunc(offset);
  const fraction = Math.abs(offset - oom_offset) || 1;

  const target_mag = current_mag + oom_offset;
  const rounding_base = Math.pow(10, target_mag) * fraction;

  let rounded = Math.round(num / rounding_base + EPSILON) * rounding_base;

  if (Math.abs(rounded) >= 10) {
    rounded = Math.round(rounded);
  }

  return rounded;
}

function toNumber(value) {
  if (typeof value === "number") {
    return isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    let cleaned = value.trim()
      .replace(/[‐-―−﹘﹣－]/g, "-")
      .replace(CLEAN_REGEX, "")
      .replace(PARENS_REGEX, "-$1");
    const parsed = Number(cleaned);
    return isFinite(parsed) ? parsed : null;
  }
  return null;
}

function validateOffset(offset, paramName) {
  if (offset < -VALIDATION_LIMIT || offset > VALIDATION_LIMIT) {
    throw new Error(paramName + " must be between -" + VALIDATION_LIMIT + " and " + VALIDATION_LIMIT + ", got " + offset);
  }
}

function restoreFormatting(roundedValue, originalString) {
  let result;
  const originalTrimmed = originalString.trim();
  
  // Check if original had decimals (ignoring commas)
  const match = originalTrimmed.match(/\.(\d+)[^\d]*$/);
  let decimals = 0;
  if (match) {
    decimals = match[1].length;
  }
  
  if (Math.abs(roundedValue) >= 10) {
    decimals = 0;
  }

  // Always use thousands separators (commas) and match original decimal padding
  result = roundedValue.toLocaleString('en-US', { 
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.max(decimals, 10) 
  });

  // Handle percent
  if (originalTrimmed.includes('%')) {
    result += '%';
  }

  // Handle plus
  if (originalTrimmed.includes('+') && roundedValue > 0) {
    result = '+' + result;
  }

  // Handle currency
  if (originalTrimmed.includes('$')) {
    result = '$' + result;
  } else if (originalTrimmed.includes('€')) {
    result = '€' + result;
  } else if (originalTrimmed.includes('£')) {
    result = '£' + result;
  } else if (originalTrimmed.includes('¥')) {
    result = '¥' + result;
  }

  // Handle parens
  if (roundedValue < 0 && /^\(.*?\)$/.test(originalTrimmed)) {
    result = '(' + result.replace('-', '') + ')';
  }
  
  return result;
}

function replaceTextPreservingHTML(cell, originalText, newText) {
  const treeWalker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null, false);
  let currentNode;
  const textNodes = [];
  
  while (currentNode = treeWalker.nextNode()) {
    textNodes.push(currentNode);
  }
  
  const nonEmptyNodes = textNodes.filter(n => n.nodeValue.trim() !== '');
  const trimmedOriginal = originalText.trim();
  
  if (nonEmptyNodes.length === 1) {
    const text = nonEmptyNodes[0].nodeValue;
    nonEmptyNodes[0].nodeValue = text.replace(trimmedOriginal, newText);
    return;
  }
  
  for (let node of nonEmptyNodes) {
    if (node.nodeValue.includes(trimmedOriginal)) {
      node.nodeValue = node.nodeValue.replace(trimmedOriginal, newText);
      return;
    }
  }
  
  if (cell.innerHTML.includes(trimmedOriginal)) {
    cell.innerHTML = cell.innerHTML.replace(trimmedOriginal, newText);
    return;
  }
  
  // Advanced replacement across multiple nodes to avoid destroying HTML structure
  let fullText = "";
  const nodePositions = [];
  for (let node of textNodes) {
    const start = fullText.length;
    fullText += node.nodeValue;
    nodePositions.push({ node, start, end: fullText.length });
  }
  
  const matchIndex = fullText.indexOf(trimmedOriginal);
  if (matchIndex !== -1) {
    const matchEnd = matchIndex + trimmedOriginal.length;
    let firstNodeIdx = -1;
    let lastNodeIdx = -1;
    
    for (let i = 0; i < nodePositions.length; i++) {
      if (nodePositions[i].end > matchIndex && firstNodeIdx === -1) {
        firstNodeIdx = i;
      }
      if (nodePositions[i].start < matchEnd) {
        lastNodeIdx = i;
      }
    }
    
    if (firstNodeIdx !== -1 && lastNodeIdx !== -1) {
      // Distribute newText across the matched nodes to preserve exact HTML span structure
      let remainingNewText = newText;
      for (let i = firstNodeIdx; i <= lastNodeIdx; i++) {
        const pos = nodePositions[i];
        const nodeStr = pos.node.nodeValue;
        
        const overlapStartInNode = Math.max(0, matchIndex - pos.start);
        const overlapEndInNode = Math.min(nodeStr.length, matchEnd - pos.start);
        const overlapLen = overlapEndInNode - overlapStartInNode;
        
        let replacementForThisNode = "";
        if (i === lastNodeIdx) {
          replacementForThisNode = remainingNewText;
        } else {
          replacementForThisNode = remainingNewText.substring(0, overlapLen);
          remainingNewText = remainingNewText.substring(overlapLen);
        }
        
        const beforeMatch = nodeStr.substring(0, overlapStartInNode);
        const afterMatch = nodeStr.substring(overlapEndInNode);
        
        pos.node.nodeValue = beforeMatch + replacementForThisNode + afterMatch;
      }
      return;
    }
  }
  
  // Removed absolute innerText fallback to completely eliminate risk of breaking column widths or DOM structures
  console.debug("Dynamic Rounding: Skipped complex multi-node cell replacement to preserve layout.");
}
