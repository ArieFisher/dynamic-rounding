/**
 * Test suite for chrome-extension content.js pure helpers.
 * Run: node tests.js
 *
 * Stubs out browser globals so we can eval content.js in Node and exercise
 * the pure functions (extractNumberInText, formatExtractedNumber, toNumber,
 * roundCellSetAware, findMaxMagnitude, restoreFormatting).
 */

const fs = require('fs');
const path = require('path');

global.chrome = {
  runtime: {
    onMessage: { addListener: () => {} },
    sendMessage: () => {}
  }
};
global.document = { addEventListener: () => {} };
global.window = { addEventListener: () => {} };
global.NodeFilter = { SHOW_TEXT: 4 };

const code = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
eval(code);

let passed = 0;
let failed = 0;
const failures = [];

function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push({ name, actual, expected });
  }
}

// --- extractNumberInText ---

eq('extract: plain comma number',
  extractNumberInText('8,584,629'),
  { numStr: '8,584,629', num: 8584629, index: 0 });

eq('extract: number with trailing word (USD)',
  extractNumberInText('8,584,629 USD'),
  { numStr: '8,584,629', num: 8584629, index: 0 });

eq('extract: number with trailing k',
  extractNumberInText('286k'),
  { numStr: '286', num: 286, index: 0 });

eq('extract: non-numeric returns null',
  extractNumberInText('N/A'),
  null);

eq('extract: number embedded mid-string',
  extractNumberInText('approx 1,234 (close)'),
  { numStr: '1,234', num: 1234, index: 7 });

eq('extract: decimal with suffix',
  extractNumberInText('1.5 hours'),
  { numStr: '1.5', num: 1.5, index: 0 });

eq('extract: empty string',
  extractNumberInText(''),
  null);

eq('extract: non-string input',
  extractNumberInText(null),
  null);

// --- formatExtractedNumber ---

eq('format: large number gets commas matching original',
  formatExtractedNumber(8500000, '8,584,629'),
  '8,500,000');

eq('format: small int no commas',
  formatExtractedNumber(300, '286'),
  '300');

eq('format: decimal padding preserved when |x|<10',
  formatExtractedNumber(1.5, '1.234'),
  '1.500');

eq('format: |x|>=10 drops decimals even if original had them',
  formatExtractedNumber(1500, '1.234'),
  '1500');

// --- toNumber sanity (covered indirectly but pin behavior) ---

eq('toNumber: plain integer string', toNumber('286'), 286);
eq('toNumber: comma number', toNumber('8,584,629'), 8584629);
eq('toNumber: currency stripped', toNumber('$1,234.56'), 1234.56);
eq('toNumber: parens treated as negative', toNumber('(500)'), -500);
eq('toNumber: trailing word -> null', toNumber('286k'), null);
eq('toNumber: pure text -> null', toNumber('N/A'), null);

// --- End-to-end magnitude + rounding parity with example table ---
// Original | excludeWords=false expected
// 8,584,629           -> 8,500,000
// 286                 -> 300
// 8,584,629 USD       -> 8,500,000 USD
// 286k                -> 300k

(function endToEnd() {
  const cells = ['8,584,629', '286', '8,584,629 USD', '286k'];
  const infos = cells.map(text => {
    const num = toNumber(text);
    if (num !== null) return { mode: 'pure', num, text };
    const ex = extractNumberInText(text);
    if (ex) return { mode: 'extracted', num: ex.num, numStr: ex.numStr, index: ex.index, text };
    return { mode: 'skip', num: null, text };
  });

  const numericRange = [infos.map(i => i.num)];
  const maxMag = findMaxMagnitude(numericRange);
  eq('e2e: max magnitude across mixed cells', maxMag, 6);

  const out = infos.map(info => {
    if (info.mode === 'skip') return info.text;
    const rounded = roundCellSetAware(info.num, info.num, maxMag, -0.5, -0.5, 1);
    if (rounded === info.num) return info.text;
    if (info.mode === 'pure') return restoreFormatting(rounded, info.text);
    const num = formatExtractedNumber(rounded, info.numStr);
    return info.text.substring(0, info.index) + num + info.text.substring(info.index + info.numStr.length);
  });

  eq('e2e: full table output', out,
    ['8,500,000', '300', '8,500,000 USD', '300k']);
})();

// --- excludeWords=true path: extracted cells skipped, pure cells still round ---
(function excludeWordsOn() {
  const cells = ['8,584,629', '286', '8,584,629 USD', '286k'];
  const infos = cells.map(text => {
    const num = toNumber(text);
    if (num !== null) return { mode: 'pure', num, text };
    return { mode: 'skip', num: null, text };
  });

  const numericRange = [infos.map(i => i.num)];
  const maxMag = findMaxMagnitude(numericRange);

  const out = infos.map(info => {
    if (info.mode === 'skip') return info.text;
    const rounded = roundCellSetAware(info.num, info.num, maxMag, -0.5, -0.5, 1);
    return info.mode === 'pure' ? restoreFormatting(rounded, info.text) : info.text;
  });

  eq('excludeWords=true: only pure-numeric cells round',
    out, ['8,500,000', '300', '8,584,629 USD', '286k']);
})();

// --- Report ---
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
  for (const f of failures) {
    console.log(`\n  ${f.name}`);
    console.log(`    expected: ${JSON.stringify(f.expected)}`);
    console.log(`    actual:   ${JSON.stringify(f.actual)}`);
  }
  process.exit(1);
}
