/**
 * Doc-example tests.
 *
 * Extracts every documented ROUND_DYNAMIC input/output pair from the repo's
 * living docs and runs it against the library, so a doc that drifts from the
 * shipped behavior fails CI instead of waiting for a reader to notice.
 * Run: node js/doc-tests.js
 *
 * Each extractor asserts a minimum pair count. When a doc's format changes
 * enough that an extractor finds fewer pairs, the run fails loudly rather
 * than passing on silence — update the extractor together with the doc.
 */

const fs = require('fs');
const path = require('path');

// Load round_dynamic.js (written for Google Apps Script, runs in Node)
eval(fs.readFileSync(path.join(__dirname, 'round_dynamic.js'), 'utf8'));

const repoRoot = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

let passed = 0;
let failed = 0;
const failures = [];

function record(ok, label) {
  if (ok) { passed++; } else { failed++; failures.push(label); }
}

function parseNumber(text) {
  const cleaned = String(text).replace(/[\\,`\s]/g, '');
  if (cleaned === '' || !/^-?[\d.]+$/.test(cleaned)) return null;
  const num = Number(cleaned);
  return isFinite(num) ? num : null;
}

// "(default)" -> undefined; "-1.5" -> -1.5
function parseOffset(text) {
  const cleaned = String(text).replace(/[\\`\s]/g, '');
  if (cleaned === '' || cleaned === '(default)') return undefined;
  return Number(cleaned);
}

function checkPair(doc, input, offset, expected) {
  const label = `${doc}: ROUND_DYNAMIC(${JSON.stringify(input)}${offset === undefined ? '' : ', ' + offset}) -> expected ${JSON.stringify(expected)}`;
  let actual;
  try {
    actual = ROUND_DYNAMIC(input, offset);
  } catch (err) {
    record(expected === 'THROWS', `${label}, threw ${err.message}`);
    return;
  }
  if (expected === 'THROWS') {
    record(false, `${label}, got ${JSON.stringify(actual)} instead of an error`);
    return;
  }
  record(actual === expected, `${label}, got ${JSON.stringify(actual)}`);
}

function checkDataset(doc, inputs, offsets, expecteds) {
  const label = `${doc}: ROUND_DYNAMIC([${inputs}]${offsets.length ? ', ' + offsets.join(', ') : ''}) -> expected [${expecteds}]`;
  const actual = ROUND_DYNAMIC(inputs.map(n => [n]), ...offsets).map(row => row[0]);
  record(actual.length === expecteds.length && actual.every((v, i) => v === expecteds[i]),
    `${label}, got [${actual}]`);
}

function assertMinCount(doc, found, min) {
  if (found < min) {
    failed++;
    failures.push(`${doc}: extractor found only ${found} examples (needs >= ${min}) — either the doc format changed (update the extractor in js/doc-tests.js) or examples were removed on purpose (lower this minimum)`);
  }
}

// --- Extractor 1: same-line formula pairs -------------------------------
// Bullets and prose: `=ROUND_DYNAMIC(<args>)` → <expected>
//                    `ROUND_DYNAMIC(<args>)` returns <expected>
// Table rows:        | `=ROUND_DYNAMIC(<args>)` | <expected> |
function extractFormulaPairs(doc, text) {
  let found = 0;
  const patterns = [
    /`=?(?:ROUND_DYNAMIC|round_dynamic)\(([^)]*)\)`\s*\|\s*([^|\n]+)/g,
    /`=?(?:ROUND_DYNAMIC|round_dynamic)\(([^)]*)\)`[^\n|]*?(?:→|->)\s*`?([^\n(`]+)/g,
    /`=?(?:ROUND_DYNAMIC|round_dynamic)\(([^)]*)\)`\s+returns\s+`?([\d,]+)/g,
  ];
  const seen = new Set();
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const argsText = m[1].replace(/\\/g, '');
      if (argsText.includes(':')) continue; // cell-range reference — prose, not a runnable pair
      const key = m[0];
      if (seen.has(key)) continue;
      seen.add(key);
      const listMatch = argsText.match(/^\[([^\]]*)\]$/); // dataset bullet: round_dynamic([...]) → [...]
      if (listMatch) {
        const inputs = listMatch[1].split(',').map(parseNumber);
        const expList = m[2].replace(/\\/g, '').match(/\[?([\d,.\s]+)\]?/);
        if (!expList || inputs.some(n => n === null)) continue;
        const expecteds = expList[1].split(/,\s(?=\d)/).map(parseNumber); // "4,500,000, 1,000,000" splits between values only
        checkDataset(doc, inputs, [], expecteds);
        found++;
        continue;
      }
      const args = argsText.split(',').map(s => s.trim());
      const quoted = args[0].match(/^"(.*)"$/);
      const input = quoted ? quoted[1] : parseNumber(args[0]);
      if (input === null) continue;
      const offset = args.length > 1 ? parseOffset(args[1]) : undefined;
      const expected = parseNumber(m[2]);
      if (expected === null) continue; // prose result — not a runnable pair
      checkPair(doc, input, offset, expected);
      found++;
    }
  }
  return found;
}

// --- Extractor 2: the offset-reference table -----------------------------
// | <offset> | <meaning> | <expected> |  under a header naming the input
// ("87,054,321 rounds to").
function extractOffsetTable(doc, text) {
  let found = 0;
  const header = text.match(/\|\s*([\d,]+)\s+rounds to\s*\|/);
  if (!header) return 0;
  const input = parseNumber(header[1]);
  const re = /^\|\s*(-?[\d.]+)\s*\|[^|\n]*\|\s*([\d,]+)\s*\|/gm;
  for (const m of text.matchAll(re)) {
    const offset = Number(m[1]);
    const expected = parseNumber(m[2]);
    if (expected === null || Math.abs(offset) > 20) continue;
    checkPair(doc, input, offset, expected);
    found++;
  }
  return found;
}

// --- Extractor 3: numeric-casting bullets --------------------------------
// - `"<string>"` → <number>   documents toNumber(), not end-to-end rounding.
function extractCastingBullets(doc, text) {
  let found = 0;
  const re = /^- `"([^"]*)"` (?:→|->) (-?[\d.,]+)/gm;
  for (const m of text.matchAll(re)) {
    const input = m[1];
    const expected = parseNumber(m[2]);
    const actual = toNumber(input);
    record(actual === expected,
      `${doc}: toNumber(${JSON.stringify(input)}) -> expected ${expected}, got ${actual}`);
    found++;
  }
  return found;
}

// --- Extractor 4: the Google Sheets test-tab spec -------------------------
// Every `| =IF(...) | ... |` row names an input, an optional offset, and an
// expected value; the sheet built from this doc must agree with the library.
function extractSheetsTab(doc, text) {
  let found = 0;
  let datasetBlock = null; // { inputs, offsets, expecteds }

  const flushDataset = () => {
    if (datasetBlock && datasetBlock.inputs.length > 1) {
      checkDataset(doc, datasetBlock.inputs, datasetBlock.offsets, datasetBlock.expecteds);
      found++;
    }
    datasetBlock = null;
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\\/g, '');
    if (!line.startsWith('| =IF(')) { flushDataset(); continue; }
    const c = line.split('|').map(s => s.trim().replace(/^`|`$/g, ''));

    if (c[1].includes('ISREF')) continue;              // cell-reference semantics; not runnable
    if (c[2] === 'TRUE' || c[2] === '#REF!') continue; // Sheets-typed values; not runnable

    if (c[1].includes('ISERR')) {                      // validation rows: out-of-range offsets throw
      checkPair(doc, parseNumber(c[2]), parseOffset(c[3]), 'THROWS');
      found++;
      continue;
    }

    if ((c[4] || '').includes(':') || datasetBlock) {  // dataset block: first row names the range
      if ((c[4] || '').includes(':')) {
        flushDataset();
        // Trailing blanks truncate; an interior blank stays undefined so the
        // library applies its own default in that position rather than the
        // next offset sliding into the wrong parameter slot.
        const offsets = [c[6], c[7], c[8]].map(parseOffset);
        while (offsets.length && offsets[offsets.length - 1] === undefined) offsets.pop();
        datasetBlock = { inputs: [], offsets, expecteds: [] };
      }
      if (datasetBlock) {
        datasetBlock.inputs.push(parseNumber(c[2]));
        datasetBlock.expecteds.push(parseNumber(c[5]));
      }
      continue;
    }

    if ((c[5] || '').startsWith('=ROUND_DYNAMIC')) {   // single-mode layout: input, offset, expected
      const input = c[2] === '' ? '' : (parseNumber(c[2]) !== null ? parseNumber(c[2]) : c[2]);
      const expected = c[6] === '(empty)' ? '' : (parseNumber(c[6]) !== null ? parseNumber(c[6]) : c[6]);
      checkPair(doc, input, parseOffset(c[3]), expected);
      found++;
    } else if ((c[4] || '').startsWith('=ROUND_DYNAMIC')) { // input-handling layout: input, expected
      const input = parseNumber(c[2]) !== null && !/[$€£¥,%()\s−]/.test(c[2]) ? parseNumber(c[2]) : c[2];
      const expected = parseNumber(c[5]) !== null ? parseNumber(c[5]) : c[5];
      checkPair(doc, input, undefined, expected);
      found++;
    }
  }
  flushDataset();
  return found;
}

// --- Extractor 5: python examples -----------------------------------------
// round_dynamic(<args>)   # → <expected>    (same-line, or comment on the next line)
// The algorithm is the shared contract, so the pairs run against this library.
function extractPythonPairs(doc, text) {
  let found = 0;
  // Prose form: `round_dynamic(<args>)` returns `<expected>`
  for (const m of text.matchAll(/`round_dynamic\(([^)]*)\)`\s+returns\s+`?([\d,]+)/g)) {
    const input = parseNumber(m[1].split(',')[0]);
    const offMatch = m[1].match(/offset\s*=\s*(-?[\d.]+)/);
    const expected = parseNumber(m[2]);
    if (input === null || expected === null) continue;
    checkPair(doc, input, offMatch ? Number(offMatch[1]) : undefined, expected);
    found++;
  }
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const call = lines[i].match(/round_dynamic\(([^)]*\)?[^)]*)\)(?!_)/);
    if (!call || lines[i].includes('_series')) continue;
    const sameLine = lines[i].match(/#\s*(?:→|->)\s*(.+)$/);
    const nextLine = !sameLine && lines[i + 1] ? lines[i + 1].match(/^#\s*(?:→|->)\s*(.+)$/) : null;
    const expectedText = sameLine ? sameLine[1] : (nextLine ? nextLine[1] : null);
    if (!expectedText) continue;

    const argsText = call[1];
    const listMatch = argsText.match(/^\[([^\]]*)\]/);
    if (listMatch) {
      const inputs = listMatch[1].split(',').map(parseNumber);
      const expList = expectedText.match(/\[([^\]]*)\]/);
      if (!expList || inputs.some(n => n === null)) continue;
      const expecteds = expList[1].split(',').map(parseNumber);
      checkDataset(doc, inputs, [], expecteds);
      found++;
    } else {
      const input = parseNumber(argsText.split(',')[0]);
      const offMatch = argsText.match(/offset\s*=\s*(-?[\d.]+)/);
      const expected = parseNumber(expectedText.split(/[\s(]/)[0]);
      if (input === null || expected === null) continue;
      checkPair(doc, input, offMatch ? Number(offMatch[1]) : undefined, expected);
      found++;
    }
  }
  return found;
}

// --- Run -------------------------------------------------------------------

const jsReadme = read('js/README.md');
const pyReadme = read('python/README.md');
const design = read('docs/design.md');
const rootReadme = read('README.md');
const sheetsTab = read('js/tests-googlesheets-tab.md');

assertMinCount('js/README.md (formulas)', extractFormulaPairs('js/README.md', jsReadme), 5);
assertMinCount('js/README.md (offset table)', extractOffsetTable('js/README.md', jsReadme), 5);
assertMinCount('js/README.md (casting)', extractCastingBullets('js/README.md', jsReadme), 5);
assertMinCount('docs/design.md (offset table)', extractOffsetTable('docs/design.md', design), 5);
assertMinCount('python/README.md', extractPythonPairs('python/README.md', pyReadme), 7);
assertMinCount('python/README.md (offset table)', extractOffsetTable('python/README.md', pyReadme), 5);
assertMinCount('README.md', extractFormulaPairs('README.md', rootReadme) + extractPythonPairs('README.md', rootReadme), 2);
assertMinCount('js/tests-googlesheets-tab.md', extractSheetsTab('js/tests-googlesheets-tab.md', sheetsTab), 20);

console.log(`\nDoc examples: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
