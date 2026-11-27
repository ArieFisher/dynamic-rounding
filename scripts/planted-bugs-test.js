#!/usr/bin/env node
/**
 * Self-test for scripts/planted-bugs.js, the planted bug script.
 *
 * The cases build a synthetic git repository in the operating system's
 * temporary folder: one small product file, a suite of a few assertions that
 * writes the record to TEST_RECORD_PATH, and the suite file. They run the
 * three modes on it and compare each result with an answer worked out by hand
 * from docs/sprint-plans/test-dedup.md, section 3. A last case runs the
 * extension suite with and without a record path.
 *
 * Run with no arguments; exits 0 when every case passes and 1 when any case
 * fails. Node standard library only.
 */

'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'planted-bugs.js');
// A guard on each script run. The fixture's measure takes a few seconds.
const RUN_LIMIT_MS = 120 * 1000;
const PRODUCT_FILE = 'app/product.js';

// The product file. Each planted bug below is worked out by hand from the
// list of changes in section 3.2.
const PRODUCT = [
  "'use strict';",
  '// A comment holds a < b && true, which is no planted bug site.',
  "const NOTE = 'x < y && true';",
  'const SHAPE = `${NOTE} < z || false`;',
  "const MODE = 'ready';",
  "if (MODE !== 'ready') throw new Error('not ready');",
  "const LABELS = { a: { text: 'A' } };",
  '',
  'function isSmall(n) {',
  '  return n < 10;',
  '}',
  '',
  'function stepsToReach(target) {',
  '  let value = 0;',
  '  let steps = 0;',
  '  while (value !== target) { value += 2; steps++; }',
  '  return steps;',
  '}',
  '',
  'function labelFor(code) {',
  '  const entry = LABELS[code];',
  "  if (!entry) return 'none';",
  '  return entry.text;',
  '}',
  '',
  'function double(n) {',
  '  return n * 2;',
  '}',
  '',
  'function unused(n) {',
  '  return n >= 5;',
  '}',
  '',
  'module.exports = { SHAPE, isSmall, stepsToReach, labelFor, double, unused };',
  '',
].join('\n');

// The setup piece writes the record at process exit, so a run that stops
// with an uncaught error still holds the assertions before the stop. The
// flaky assertion fails in the run that takes slot 2 of the folder in
// FIXTURE_FLAKY_DIR, which is one of the clean runs of measure.
const SETUP = [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  'const entries = [];',
  'process.on(\'exit\', () => {',
  '  if (process.env.TEST_RECORD_PATH) fs.writeFileSync(process.env.TEST_RECORD_PATH, JSON.stringify(entries));',
  '});',
  "const product = require('../product.js');",
  'const SITE = /\\/(app\\/tests\\/[\\w-]+\\.js):(\\d+):\\d+/;',
  'function eq(name, actual, expected) {',
  '  const passed = JSON.stringify(actual) === JSON.stringify(expected);',
  "  const site = new Error().stack.split('\\n').slice(2).map((frame) => frame.match(SITE)).find(Boolean);",
  '  entries.push({ piece: site[1], line: Number(site[2]), name, passed });',
  '  if (!passed) process.exitCode = 1;',
  '}',
  'function flakySlot() {',
  '  const dir = process.env.FIXTURE_FLAKY_DIR;',
  '  if (!dir) return 0;',
  '  for (let slot = 1; slot < 1000; slot++) {',
  "    try { fs.writeFileSync(path.join(dir, String(slot)), '', { flag: 'wx' }); return slot; } catch (error) {",
  "      if (error.code !== 'EEXIST') throw error;",
  '    }',
  '  }',
  "  throw new Error('no free flaky slot');",
  '}',
  'module.exports = { eq, product, flakySlot };',
  '',
].join('\n');

const PIECE_A = [
  "'use strict';",
  "const { eq, product } = require('./setup.js');",
  "eq('isSmall 9 is true', product.isSmall(9), true);",
  "eq('isSmall 10 is false', product.isSmall(10), false);",
  "eq('stepsToReach 4 is 2', product.stepsToReach(4), 2);",
  "eq('stepsToReach 4 is 2 again', product.stepsToReach(4), 2);",
  '',
].join('\n');

const PIECE_B = [
  "'use strict';",
  "const { eq, product, flakySlot } = require('./setup.js');",
  "eq('labelFor zz is none', product.labelFor('zz'), 'none');",
  "eq('isSmall 10 and 11 are false', [product.isSmall(10), product.isSmall(11)], [false, false]);",
  "eq('flaky in one clean run', flakySlot() === 2 ? 'unstable' : 'stable', 'stable');",
  "eq('double 3 is 6', product.double(3), 6);",
  '',
].join('\n');

const RUNNER = [
  "'use strict';",
  "for (const piece of ['setup.js', 'a-tests.js', 'b-tests.js']) require(`./tests/${piece}`);",
  '',
].join('\n');

const FIXTURE_FILES = {
  [PRODUCT_FILE]: PRODUCT,
  'app/tests.js': RUNNER,
  'app/tests/setup.js': SETUP,
  'app/tests/a-tests.js': PIECE_A,
  'app/tests/b-tests.js': PIECE_B,
};

// Each planted bug: a text that finds its line, the code before and after,
// and the outcome (section 3.3). 'invalid' stops the suite before its first
// assertion.
const EXPECTED_BUGS = [
  { at: "if (MODE !== 'ready')", before: '!==', after: '===', outcome: 'invalid' },
  { at: "if (MODE !== 'ready')", before: "MODE !== 'ready'", after: 'true', outcome: 'invalid' },
  { at: "if (MODE !== 'ready')", before: "MODE !== 'ready'", after: 'false', outcome: 'not caught' },
  { at: 'return n < 10;', before: '<', after: '<=', outcome: 'assertions' },
  { at: 'return n < 10;', before: '10', after: '11', outcome: 'assertions' },
  { at: 'let value = 0;', before: '0', after: '1', outcome: 'timeout' },
  { at: 'let steps = 0;', before: '0', after: '1', outcome: 'assertions' },
  { at: 'while (value !== target)', before: '!==', after: '===', outcome: 'assertions' },
  { at: 'while (value !== target)', before: '2', after: '3', outcome: 'timeout' },
  { at: "if (!entry) return 'none';", before: '!entry', after: 'true', outcome: 'not caught' },
  { at: "if (!entry) return 'none';", before: '!entry', after: 'false', outcome: 'crash' },
  { at: "if (!entry) return 'none';", before: '!', after: '', outcome: 'crash' },
  { at: 'return n * 2;', before: '2', after: '3', outcome: 'assertions' },
  { at: 'return n >= 5;', before: '>=', after: '>', outcome: 'not caught' },
  { at: 'return n >= 5;', before: '5', after: '6', outcome: 'not caught' },
];

function lineOf(text) {
  const index = PRODUCT.split('\n').findIndex((line) => line.includes(text));
  if (index < 0) throw new Error(`no product line holds ${text}`);
  return index + 1;
}

function bugKey(line, before, after) {
  return `${PRODUCT_FILE}:${line} "${before}" to "${after}"`;
}

const SMALL_10 = [bugKey(lineOf('return n < 10;'), '<', '<='), bugKey(lineOf('return n < 10;'), '10', '11')];
const STEPS = [bugKey(lineOf('let steps = 0;'), '0', '1'), bugKey(lineOf('while (value !== target)'), '!==', '===')];
const DOUBLE = [bugKey(lineOf('return n * 2;'), '2', '3')];

// Each assertion's catch list. The crash and timeout outcomes credit no
// assertion (section 3.3), so the labelFor assertion catches nothing.
const EXPECTED_CATCHES = {
  'isSmall 9 is true': [],
  'isSmall 10 is false': SMALL_10,
  'stepsToReach 4 is 2': STEPS,
  'stepsToReach 4 is 2 again': STEPS,
  'labelFor zz is none': [],
  'isSmall 10 and 11 are false': SMALL_10,
  'flaky in one clean run': [],
  'double 3 is 6': DOUBLE,
};

// Section 3.5: the walk drops "isSmall 10 is false" and "stepsToReach 4 is 2"
// first, so the assertion each one repeats stays.
const EXPECTED_SORT = {
  'catches nothing': ['isSmall 9 is true', 'labelFor zz is none'],
  'repeats others': ['isSmall 10 is false', 'stepsToReach 4 is 2'],
  unique: ['stepsToReach 4 is 2 again', 'isSmall 10 and 11 are false', 'double 3 is 6'],
  flaky: ['flaky in one clean run'],
};

const CAUGHT_COUNT = EXPECTED_BUGS.filter((bug) => ['assertions', 'crash', 'timeout'].includes(bug.outcome)).length;

let passed = 0;
let failed = 0;

function recordPass(name) {
  passed++;
  process.stdout.write('  pass  ' + name + '\n');
}

function recordFail(name, detail) {
  failed++;
  process.stdout.write('  FAIL  ' + name + '\n        ' + detail.split('\n').join('\n        ') + '\n');
}

// Runs one case: the body returns nothing on a pass and a failure detail
// string, or throws, on a failure.
async function check(name, body) {
  let detail;
  try {
    detail = await body();
  } catch (err) {
    detail = 'threw: ' + err.message;
  }
  if (detail) recordFail(name, detail);
  else recordPass(name);
}

function differs(what, actual, expected) {
  const actualText = JSON.stringify(actual, null, 1);
  const expectedText = JSON.stringify(expected, null, 1);
  return actualText === expectedText ? null : `${what}\n expected ${expectedText}\n actual ${actualText}`;
}

// --- The synthetic repository ---

const GIT_CONFIG = ['-c', 'user.name=planted-bugs-test', '-c', 'user.email=planted-bugs-test@example.invalid',
  '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', '-c', 'init.defaultBranch=main'];

function git(repo, ...args) {
  return childProcess.execFileSync('git', [...GIT_CONFIG, '-C', repo, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function writeFiles(repo, files) {
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(repo, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
}

function commitBranch(repo, branch, files) {
  git(repo, 'checkout', '-q', '-b', branch, 'main');
  writeFiles(repo, files);
  git(repo, 'add', '--', ...Object.keys(files));
  git(repo, 'commit', '-q', '-m', branch);
  git(repo, 'checkout', '-q', 'main');
}

function withoutLine(text, part) {
  const lines = text.split('\n');
  const kept = lines.filter((line) => !line.includes(part));
  if (kept.length !== lines.length - 1) throw new Error(`expected one line holding ${part}`);
  return kept.join('\n');
}

function buildFixture(temp) {
  const repo = path.join(temp, 'repo');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q');
  writeFiles(repo, FIXTURE_FILES);
  git(repo, 'add', '--', ...Object.keys(FIXTURE_FILES));
  git(repo, 'commit', '-q', '-m', 'fixture');
  git(repo, 'branch', '-M', 'main');
  commitBranch(repo, 'delete-unique', { 'app/tests/b-tests.js': withoutLine(PIECE_B, "'double 3 is 6'") });
  commitBranch(repo, 'delete-repeat', { 'app/tests/a-tests.js': withoutLine(PIECE_A, "'stepsToReach 4 is 2',") });
  commitBranch(repo, 'delete-crash-trigger', { 'app/tests/b-tests.js': withoutLine(PIECE_B, "'labelFor zz is none'") });
  commitBranch(repo, 'change-product', { [PRODUCT_FILE]: PRODUCT.replace('n >= 5', 'n >= 7') });
  const suite = path.join(temp, 'suite.json');
  fs.writeFileSync(suite, JSON.stringify({
    command: [process.execPath, 'app/tests.js'],
    productDir: 'app',
    testPaths: ['app/tests.js', 'app/tests'],
  }));
  const scriptTemp = path.join(temp, 'script-temp');
  fs.mkdirSync(scriptTemp);
  const flaky = path.join(temp, 'flaky');
  fs.mkdirSync(flaky);
  return { repo, suite, scriptTemp, flaky, result: path.join(temp, 'result.json') };
}

// The script makes its worker copies under TMPDIR, so the fixture's own
// folder shows what the script leaves behind.
function runScript(fixture, args, extraEnv = {}) {
  const started = Date.now();
  const run = childProcess.spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    timeout: RUN_LIMIT_MS,
    env: { ...process.env, TEST_RECORD_PATH: '', TMPDIR: fixture.scriptTemp, ...extraEnv },
  });
  return { ...run, elapsedMs: Date.now() - started };
}

function prove(fixture, branch) {
  return runScript(fixture, ['prove', '--in', fixture.result, '--branch', branch, '--root', fixture.repo]);
}

function leftovers(fixture) {
  const worktrees = git(fixture.repo, 'worktree', 'list', '--porcelain')
    .split('\n').filter((line) => line.startsWith('worktree ')).length;
  const folders = fs.readdirSync(fixture.scriptTemp);
  return worktrees === 1 && folders.length === 0
    ? null : `worktrees: ${worktrees} (expected 1); temporary folders left: ${JSON.stringify(folders)}`;
}

function exitDetail(run) {
  return `exit ${run.status}${run.signal ? ` signal ${run.signal}` : ''}\n stdout: ${run.stdout}\n stderr: ${run.stderr}`;
}

// --- Reading the result file and the sort output ---

function bugKeys(result) {
  return new Map(result.plantedBugs.map((bug) => [bug.id, bugKey(bug.line, bug.before, bug.after)]));
}

function parseSort(stdout) {
  const lists = {};
  let current = null;
  for (const line of stdout.split('\n')) {
    const header = line.match(/^(\S.*) \((\d+)\)$/);
    if (header) { current = header[1]; lists[current] = []; continue; }
    const assertion = line.match(/^ {4}\d+ {2}(.*)$/);
    if (assertion && current) lists[current].push(assertion[1]);
  }
  return lists;
}

// --- Cases ---

async function measureCases(fixture) {
  const run = runScript(fixture, ['measure', '--out', fixture.result, '--root', fixture.repo,
    '--commit', 'main', '--suite', fixture.suite], { FIXTURE_FLAKY_DIR: fixture.flaky });
  let result = null;
  await check('measure on the fixture: exits 0 and writes the result file', () => {
    if (run.status !== 0) return exitDetail(run);
    result = JSON.parse(fs.readFileSync(fixture.result, 'utf8'));
    return null;
  });
  if (!result) return null;
  process.stdout.write(`        measure took ${run.elapsedMs} ms\n`);
  const keys = bugKeys(result);

  await check('measure on a product file with < && true || false in a comment, a string, and template text: no planted bug on those lines', () => {
    const textLines = [2, 3, 4];
    const inText = result.plantedBugs.filter((bug) => bug.file === PRODUCT_FILE && textLines.includes(bug.line));
    return inText.length ? `planted bugs in text: ${JSON.stringify(inText)}` : null;
  });

  await check('measure on the fixture: the planted bugs and their outcomes match the hand-computed list', () => {
    const actual = result.plantedBugs.map((bug) => `${keys.get(bug.id)} ${bug.outcome}`).sort();
    const expected = EXPECTED_BUGS.map((bug) => `${bugKey(lineOf(bug.at), bug.before, bug.after)} ${bug.outcome}`).sort();
    return differs('planted bugs', actual, expected);
  });

  await check('measure on the fixture: each assertion\'s catch list matches the hand-computed list', () => {
    const actual = Object.fromEntries(result.assertions.map((assertion) =>
      [assertion.name, assertion.catches.map((id) => keys.get(id)).sort()]));
    const expected = Object.fromEntries(Object.entries(EXPECTED_CATCHES).map(([name, list]) => [name, [...list].sort()]));
    return differs('catch lists', actual, expected);
  });

  await check('measure on a planted bug that loops forever: stops at the time cap and counts as caught by a timeout', () => {
    const looping = result.plantedBugs.filter((bug) => bug.line === lineOf('let value = 0;'));
    if (looping.length !== 1 || looping[0].outcome !== 'timeout') return `the looping planted bug: ${JSON.stringify(looping)}`;
    const slowestClean = Math.max(...result.cleanRunMs);
    if (!(result.timeCapMs >= 3 * slowestClean)) return `time cap ${result.timeCapMs} ms is under 3 x ${slowestClean} ms`;
    return run.elapsedMs < RUN_LIMIT_MS ? null : `measure ran ${run.elapsedMs} ms`;
  });

  await check('measure on a planted bug that stops the suite before its first assertion: counted as invalid and in no catch list', () => {
    const invalidIds = result.plantedBugs.filter((bug) => bug.outcome === 'invalid').map((bug) => bug.id);
    const credited = result.assertions.flatMap((assertion) => assertion.catches).filter((id) => invalidIds.includes(id));
    if (credited.length) return `invalid planted bugs in a catch list: ${credited}`;
    return differs('outcome counts', result.outcomes, { invalid: 2, 'not caught': 4, assertions: 5, timeout: 2, crash: 2 });
  });

  await check('measure on an assertion that fails in one of the three clean runs: marked flaky, every other assertion not flaky', () => {
    const flaky = result.assertions.filter((assertion) => assertion.flaky).map((assertion) => assertion.name);
    return differs('flaky assertions', flaky, ['flaky in one clean run']);
  });

  await check('measure on the fixture: no worker copy or temporary folder is left', () => leftovers(fixture));
  return result;
}

async function sortCases(fixture) {
  const run = runScript(fixture, ['sort', '--in', fixture.result]);
  await check('sort on the fixture: catches nothing, repeats others, unique, and flaky match the hand-computed lists', () => {
    if (run.status !== 0) return exitDetail(run);
    return differs('sort lists', parseSort(run.stdout), EXPECTED_SORT);
  });
}

async function proveCases(fixture) {
  await check('prove on a branch that deletes a unique assertion: exits 1 and names the planted bug only it caught', () => {
    const run = prove(fixture, 'delete-unique');
    const expected = `${PRODUCT_FILE}:${lineOf('return n * 2;')}:`;
    return run.status === 1 && run.stderr.includes('no longer caught') && run.stderr.includes(expected)
      ? leftovers(fixture) : exitDetail(run);
  });

  await check(`prove on a branch that deletes a repeating assertion: reruns all ${CAUGHT_COUNT} caught planted bugs and exits 0`, () => {
    const run = prove(fixture, 'delete-repeat');
    return run.status === 0 && run.stdout.includes(`proved: ${CAUGHT_COUNT} rerun`) ? leftovers(fixture) : exitDetail(run);
  });

  await check('prove on a branch that deletes the assertion whose call crashes the suite: exits 1, the crash catches are lost', () => {
    const run = prove(fixture, 'delete-crash-trigger');
    return run.status === 1 && run.stderr.includes(`${PRODUCT_FILE}:${lineOf("if (!entry) return 'none';")}:`)
      ? leftovers(fixture) : exitDetail(run);
  });

  await check('prove on a branch that changes product code: exits 1 with "measure again"', () => {
    const run = prove(fixture, 'change-product');
    return run.status === 1 && run.stderr.includes('measure again') ? leftovers(fixture) : exitDetail(run);
  });
}

function runExtensionSuite(recordPath) {
  return new Promise((resolve) => {
    const env = { ...process.env, TEST_RECORD_PATH: recordPath };
    const child = childProcess.spawn(process.execPath, ['chrome-extension/tests.js'],
      { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'ignore'] });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.on('close', (status) => {
      const count = (label) => Number((stdout.match(new RegExp(`^${label}: (\\d+)$`, 'm')) || [])[1]);
      resolve({ status, total: count('Passed') + count('Failed') });
    });
  });
}

async function extensionCase(temp) {
  await check('the extension suite with and without a record path: the same assertion count, and one record entry per assertion', async () => {
    const recordPath = path.join(temp, 'extension-record.json');
    const [plain, recorded] = await Promise.all([runExtensionSuite(''), runExtensionSuite(recordPath)]);
    if (plain.status !== 0 || recorded.status !== 0) return `exit codes ${plain.status} and ${recorded.status}`;
    const entries = JSON.parse(fs.readFileSync(recordPath, 'utf8')).length;
    process.stdout.write(`        extension suite assertions: ${plain.total}\n`);
    return plain.total > 0 && plain.total === recorded.total && recorded.total === entries
      ? null : `without a record path ${plain.total}, with one ${recorded.total}, record entries ${entries}`;
  });
}

async function main() {
  const started = Date.now();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'planted-bugs-test-'));
  try {
    const fixture = buildFixture(temp);
    const result = await measureCases(fixture);
    if (result) {
      await sortCases(fixture);
      await proveCases(fixture);
    }
    await extensionCase(temp);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  process.stdout.write(`${passed} passed, ${failed} failed in ${Date.now() - started} ms\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
