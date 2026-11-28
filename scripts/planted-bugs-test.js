#!/usr/bin/env node
/**
 * Self-test for scripts/planted-bugs.js, the planted bug script.
 *
 * The first cases list the planted bugs in short snippets of code. The rest
 * build three synthetic git repositories in the operating system's
 * temporary folder, each with one small product file and a suite of a few
 * assertions that writes the record to TEST_RECORD_PATH, plus the suite
 * file. They run the three modes on them and compare each result with an
 * answer worked out by hand from docs/sprint-plans/test-dedup.md, section 3.
 * A last case runs the extension suite with and without a record path.
 *
 * Run with no arguments; exits 0 when every case passes and 1 when any case
 * fails. Node standard library only.
 */

'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { plantBugs } = require('./planted-bugs-lexer.js');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'planted-bugs.js');
// A guard on each script run. The fixture's measure takes a few seconds.
const RUN_LIMIT_MS = 120 * 1000;
const PRODUCT_FILE = 'app/product.js';

// The product file. Each planted bug below is worked out by hand from the
// list of changes in section 3.2.
const PRODUCT = [
  "'use strict';",
  '// A comment holds a < b && true and the pattern /^a?b+$/; neither gets a planted bug.',
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

// Each suite run that calls takeSlot gets the next free number in the folder,
// which orders runs that the script starts at the same time.
const TAKE_SLOT = [
  'function takeSlot(dir) {',
  '  for (let slot = 1; slot < 1000; slot++) {',
  "    try { fs.writeFileSync(path.join(dir, String(slot)), '', { flag: 'wx' }); return slot; } catch (error) {",
  "      if (error.code !== 'EEXIST') throw error;",
  '    }',
  '  }',
  "  throw new Error('no free slot');",
  '}',
];

// The setup piece writes the record at process exit, so a run that stops
// with an uncaught error still holds the assertions before the stop. The
// flaky assertion fails in the run that takes slot 2 of the folder in
// FIXTURE_FLAKY_DIR, which is one of the three clean runs of measure. With
// FIXTURE_FLAKY_LATER set, it also fails in every run after them, which are
// the planted bug runs.
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
  ...TAKE_SLOT,
  'function flakyFails() {',
  '  const slot = process.env.FIXTURE_FLAKY_DIR ? takeSlot(process.env.FIXTURE_FLAKY_DIR) : 0;',
  "  return slot === 2 || (process.env.FIXTURE_FLAKY_LATER === '1' && slot > 3);",
  '}',
  'module.exports = { eq, product, flakyFails };',
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
  "const { eq, product, flakyFails } = require('./setup.js');",
  "eq('labelFor zz is none', product.labelFor('zz'), 'none');",
  "eq('isSmall 10 and 11 are false', [product.isSmall(10), product.isSmall(11)], [false, false]);",
  "eq('flaky in one clean run', flakyFails() ? 'unstable' : 'stable', 'stable');",
  "eq('double 3 is 6', product.double(3), 6);",
  '',
].join('\n');

// With FIXTURE_RUNS_DIR set, each suite run writes a file named by its
// process id there, so a case can find every suite run of one script run.
// With FIXTURE_BAD_RECORD_DIR set, slots 1 to 3 are the clean runs, slot 4
// is the first planted bug run, which writes {} as its record, and every
// later run stays alive until it is killed.
const BAD_RECORD_SLOT = 4;
const RUNNER = [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  "if (process.env.FIXTURE_RUNS_DIR) fs.writeFileSync(`${process.env.FIXTURE_RUNS_DIR}/${process.pid}`, '');",
  ...TAKE_SLOT,
  'if (process.env.FIXTURE_BAD_RECORD_DIR) {',
  '  const slot = takeSlot(process.env.FIXTURE_BAD_RECORD_DIR);',
  `  if (slot === ${BAD_RECORD_SLOT}) { fs.writeFileSync(process.env.TEST_RECORD_PATH, '{}'); process.exit(0); }`,
  `  if (slot > ${BAD_RECORD_SLOT}) setInterval(() => {}, 1000);`,
  '}',
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

// A second repository with the same runner and setup. Piece B's assertions
// are the only catchers of its 3 planted bugs, and their inputs come from a
// list piece A defines and from a data file outside the test and product
// folders.
const CROSS_PRODUCT = [
  "'use strict';",
  'function isSmall(n) {',
  '  return n < 10;',
  '}',
  'function double(n) {',
  '  return n * 2;',
  '}',
  'module.exports = { isSmall, double };',
  '',
].join('\n');

const CROSS_PIECE_A = [
  "'use strict';",
  'globalThis.SIZES = [9, 10];',
  '',
].join('\n');

const CROSS_PIECE_B = [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  "const { eq, product } = require('./setup.js');",
  'for (const n of globalThis.SIZES) eq(`isSmall ${n} is ${n < 10}`, product.isSmall(n), n < 10);',
  "const doubles = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'doubles.json'), 'utf8'));",
  'for (const [n, twice] of doubles) eq(`double ${n} is ${twice}`, product.double(n), twice);',
  '',
].join('\n');

const CROSS_FILES = {
  [PRODUCT_FILE]: CROSS_PRODUCT,
  'app/tests.js': RUNNER,
  'app/tests/setup.js': SETUP,
  'app/tests/a-tests.js': CROSS_PIECE_A,
  'app/tests/b-tests.js': CROSS_PIECE_B,
  'data/doubles.json': '[[3, 6]]\n',
};

// Each assertion of piece B with the planted bugs only it catches.
const CROSS_SMALL_10 = 'app/tests/b-tests.js:5  isSmall 10 is false';
const CROSS_DOUBLE_3 = 'app/tests/b-tests.js:7  double 3 is 6';
const EXPECTED_CROSS_CATCHES = {
  'isSmall 9 is true': [],
  'isSmall 10 is false': [bugKey(3, '<', '<='), bugKey(3, '10', '11')],
  'double 3 is 6': [bugKey(6, '2', '3')],
};

// A third repository with the same runner and setup. A regular expression
// literal and a pattern in string text each read two forms of a month; each
// piece checks one function with one assertion per form.
const PATTERN_PRODUCT = [
  "'use strict';",
  'const DAY = /^(Dec|December) (\\d+)$/;',
  "const YEAR = new RegExp('^(Jan|January) (\\\\d+)$');",
  'function dayOf(text) {',
  '  const match = DAY.exec(text);',
  '  return match ? Number(match[2]) : null;',
  '}',
  'function yearOf(text) {',
  '  const match = YEAR.exec(text);',
  '  return match ? Number(match[2]) : null;',
  '}',
  'module.exports = { dayOf, yearOf };',
  '',
].join('\n');

const PATTERN_FILES = {
  [PRODUCT_FILE]: PATTERN_PRODUCT,
  'app/tests.js': RUNNER,
  'app/tests/setup.js': SETUP,
  'app/tests/a-tests.js': [
    "'use strict';",
    "const { eq, product } = require('./setup.js');",
    "eq('dayOf Dec 25 is 25', product.dayOf('Dec 25'), 25);",
    "eq('dayOf December 31 is 31', product.dayOf('December 31'), 31);",
    '',
  ].join('\n'),
  'app/tests/b-tests.js': [
    "'use strict';",
    "const { eq, product } = require('./setup.js');",
    "eq('yearOf Jan 2020 is 2020', product.yearOf('Jan 2020'), 2020);",
    "eq('yearOf January 2021 is 2021', product.yearOf('January 2021'), 2021);",
    '',
  ].join('\n'),
};

// No assertion holds a form without its anchors, so an anchor removal is not
// caught. Removing one alternative fails only the assertion on that form.
const EXPECTED_PATTERN_OUTCOMES = [
  [2, '^', '', 'not caught'], [2, '$', '', 'not caught'], [2, '+', '', 'assertions'],
  [2, 'Dec|', '', 'assertions'], [2, '|December', '', 'assertions'],
  [3, '^', '', 'not caught'], [3, '$', '', 'not caught'], [3, '+', '', 'assertions'],
  [3, 'Jan|', '', 'assertions'], [3, '|January', '', 'assertions'],
  [6, '2', '3', 'assertions'], [10, '2', '3', 'assertions'],
].map(([line, before, after, outcome]) => `${bugKey(line, before, after)} ${outcome}`).sort();

const EXPECTED_PATTERN_SORT = {
  'catches nothing': [],
  'repeats others': [],
  unique: ['dayOf Dec 25 is 25', 'dayOf December 31 is 31', 'yearOf Jan 2020 is 2020', 'yearOf January 2021 is 2021'],
  flaky: [],
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

function moveBranch(repo, branch, from, to) {
  git(repo, 'checkout', '-q', '-b', branch, 'main');
  fs.mkdirSync(path.dirname(path.join(repo, to)), { recursive: true });
  git(repo, 'mv', from, to);
  git(repo, 'commit', '-q', '-m', branch);
  git(repo, 'checkout', '-q', 'main');
}

function withoutLine(text, part) {
  const lines = text.split('\n');
  const kept = lines.filter((line) => !line.includes(part));
  if (kept.length !== lines.length - 1) throw new Error(`expected one line holding ${part}`);
  return kept.join('\n');
}

function initRepo(repo, files) {
  fs.mkdirSync(repo);
  git(repo, 'init', '-q');
  writeFiles(repo, files);
  git(repo, 'add', '--', ...Object.keys(files));
  git(repo, 'commit', '-q', '-m', 'fixture');
  git(repo, 'branch', '-M', 'main');
}

function buildFixture(temp) {
  const repo = path.join(temp, 'repo');
  initRepo(repo, FIXTURE_FILES);
  commitBranch(repo, 'delete-unique', { 'app/tests/b-tests.js': withoutLine(PIECE_B, "'double 3 is 6'") });
  commitBranch(repo, 'delete-repeat', { 'app/tests/a-tests.js': withoutLine(PIECE_A, "'stepsToReach 4 is 2',") });
  commitBranch(repo, 'delete-crash-trigger', { 'app/tests/b-tests.js': withoutLine(PIECE_B, "'labelFor zz is none'") });
  commitBranch(repo, 'change-product', { [PRODUCT_FILE]: PRODUCT.replace('n >= 5', 'n >= 7') });
  moveBranch(repo, 'move-product-out', PRODUCT_FILE, 'lib/product.js');
  const crossRepo = path.join(temp, 'cross-repo');
  initRepo(crossRepo, CROSS_FILES);
  commitBranch(crossRepo, 'shrink-list', { 'app/tests/a-tests.js': CROSS_PIECE_A.replace('[9, 10]', '[9]') });
  commitBranch(crossRepo, 'trim-data', { 'data/doubles.json': '[]\n' });
  const patternRepo = path.join(temp, 'pattern-repo');
  initRepo(patternRepo, PATTERN_FILES);
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
  return {
    temp, repo, suite, scriptTemp, flaky, result: path.join(temp, 'result.json'),
    cross: { repo: crossRepo, suite, scriptTemp, result: path.join(temp, 'cross-result.json') },
    pattern: { repo: patternRepo, suite, scriptTemp, result: path.join(temp, 'pattern-result.json') },
  };
}

function freshDir(fixture, name) {
  const dir = path.join(fixture.temp, name);
  fs.mkdirSync(dir);
  return dir;
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

const EXPECTED_OUTCOMES = EXPECTED_BUGS
  .map((bug) => `${bugKey(lineOf(bug.at), bug.before, bug.after)} ${bug.outcome}`).sort();

function outcomeList(result) {
  const keys = bugKeys(result);
  return result.plantedBugs.map((bug) => `${keys.get(bug.id)} ${bug.outcome}`).sort();
}

function catchLists(result) {
  const keys = bugKeys(result);
  return Object.fromEntries(result.assertions.map((assertion) =>
    [assertion.name, assertion.catches.map((id) => keys.get(id)).sort()]));
}

function sortedLists(lists) {
  return Object.fromEntries(Object.entries(lists).map(([name, list]) => [name, [...list].sort()]));
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

  await check('measure on a product file with < && true and a pattern in a comment, and < && true || false in string and template text without pattern syntax: no planted bug on those lines', () => {
    const textLines = [2, 3, 4];
    const inText = result.plantedBugs.filter((bug) => bug.file === PRODUCT_FILE && textLines.includes(bug.line));
    return inText.length ? `planted bugs in text: ${JSON.stringify(inText)}` : null;
  });

  await check('measure on the fixture: the planted bugs and their outcomes match the hand-computed list', () =>
    differs('planted bugs', outcomeList(result), EXPECTED_OUTCOMES));

  await check('measure on the fixture: each assertion\'s catch list matches the hand-computed list', () =>
    differs('catch lists', catchLists(result), sortedLists(EXPECTED_CATCHES)));

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

  await check('prove on a branch that moves a product file out of the product folder: exits 1 with "measure again"', () => {
    const run = prove(fixture, 'move-product-out');
    return run.status === 1 && run.stderr.includes('measure again') ? leftovers(fixture) : exitDetail(run);
  });
}

function measureArgs(fixture, out) {
  return ['measure', '--out', out, '--root', fixture.repo, '--commit', 'main', '--suite', fixture.suite];
}

async function measureFailureCases(fixture) {
  await check('measure on an assertion that fails in one clean run and in every planted bug run: each planted bug keeps its hand-computed outcome', () => {
    const flakyDir = freshDir(fixture, 'flaky-later');
    const out = path.join(fixture.temp, 'flaky-later-result.json');
    const run = runScript(fixture, measureArgs(fixture, out), { FIXTURE_FLAKY_DIR: flakyDir, FIXTURE_FLAKY_LATER: '1' });
    if (run.status !== 0) return exitDetail(run);
    const slots = fs.readdirSync(flakyDir).length;
    if (slots <= 3) return `the flaky assertion ran in no planted bug run (${slots} slots taken)`;
    return differs('planted bugs', outcomeList(JSON.parse(fs.readFileSync(out, 'utf8'))), EXPECTED_OUTCOMES) ||
      leftovers(fixture);
  });

  await check('measure with --out in a missing folder: exits 2 and starts no suite run', () => {
    const runsDir = freshDir(fixture, 'missing-out-runs');
    const run = runScript(fixture, measureArgs(fixture, path.join(fixture.temp, 'missing', 'result.json')),
      { FIXTURE_RUNS_DIR: runsDir });
    const runs = fs.readdirSync(runsDir).length;
    return run.status === 2 && runs === 0 ? leftovers(fixture) : `suite runs: ${runs}\n${exitDetail(run)}`;
  });
}

async function crossPieceCases(fixture) {
  const { cross } = fixture;
  const run = runScript(cross, measureArgs(cross, cross.result));
  let measured = false;
  await check('measure on a piece that loops over a list from another piece and over a data file: its assertions catch the hand-computed planted bugs', () => {
    if (run.status !== 0) return exitDetail(run);
    const result = JSON.parse(fs.readFileSync(cross.result, 'utf8'));
    const detail = differs('catch lists', catchLists(result), sortedLists(EXPECTED_CROSS_CATCHES));
    measured = !detail;
    return detail;
  });
  if (!measured) return;

  await check('prove on a branch that shrinks the list in piece A that piece B loops over: exits 1 and names the 2 lost planted bugs with the piece B assertion under them', () => {
    const lost = prove(cross, 'shrink-list');
    return lost.status === 1 && lost.stderr.includes('2 of 3 rerun') && lost.stderr.includes(`${PRODUCT_FILE}:3:`) &&
      lost.stderr.includes(CROSS_SMALL_10) ? leftovers(cross) : exitDetail(lost);
  });

  await check('prove on a branch that trims a data file outside the test and product folders: exits 1 and names the lost planted bug', () => {
    const lost = prove(cross, 'trim-data');
    return lost.status === 1 && lost.stderr.includes('1 of 3 rerun') && lost.stderr.includes(`${PRODUCT_FILE}:6:`) &&
      lost.stderr.includes(CROSS_DOUBLE_3) ? leftovers(cross) : exitDetail(lost);
  });
}

async function patternFormCases(fixture) {
  const { pattern } = fixture;
  const run = runScript(pattern, measureArgs(pattern, pattern.result));
  let measured = false;
  await check('measure on a product file whose regular expression literal and string pattern each read Dec|December or Jan|January: the planted bugs and their outcomes match the hand-computed list', () => {
    if (run.status !== 0) return exitDetail(run);
    const detail = differs('planted bugs', outcomeList(JSON.parse(fs.readFileSync(pattern.result, 'utf8'))),
      EXPECTED_PATTERN_OUTCOMES);
    measured = !detail;
    return detail || leftovers(pattern);
  });
  if (!measured) return;

  await check('sort on that result: each assertion on one form of a month is unique', () => {
    const sorted = runScript(pattern, ['sort', '--in', pattern.result]);
    return sorted.status === 0 ? differs('sort lists', parseSort(sorted.stdout), EXPECTED_PATTERN_SORT) : exitDetail(sorted);
  });
}

// --- plantBugs on snippets ---

// Each row: a snippet, and each planted bug as its change and the snippet
// after it, worked out by hand from the pattern changes in section 3.2.
const REGEX_LITERAL_ROWS = [
  ['x = /ab?c/;', ['? quantifier removed: x = /abc/;']],
  ['x = /a*b/;', ['* to +: x = /a+b/;']],
  ['x = /a+b/;', ['+ quantifier removed: x = /ab/;']],
  ['x = /^a$/;', ['anchor removed: x = /a$/;', 'anchor removed: x = /^a/;']],
  ['x = /a|b|c/;', ['alternative removed: x = /b|c/;', 'alternative removed: x = /a|c/;', 'alternative removed: x = /a|b/;']],
  ['x = /x(?:a|b)y/;', ['alternative removed: x = /x(?:b)y/;', 'alternative removed: x = /x(?:a)y/;']],
  ['x = /[ab]c/;', ['first class member removed: x = /[b]c/;']],
  ['x = /[^ab]/;', ['first class member removed: x = /[^b]/;']],
  ['x = /[a]c/;', []],
  ['x = /x[*+?|$^]/;', ['first class member removed: x = /x[+?|$^]/;']],
  ['x = /(?:a)(?<n>b)(?=c)(?!d)(?<=e)(?<!f)/;', []],
  ['x = /a+?b*?/;', ['+ quantifier removed: x = /a?b*?/;', '* to +: x = /a+?b+?/;']],
  ['x = /c??/;', ['? quantifier removed: x = /c?/;']],
  ['x = /a{2}?/;', []],
  ['x = /a\\?b/;', []],
  ['x = /(?<n>a)|\\k<n>/u;', ['alternative removed: x = /(?<n>a)/u;']],
  ['x = `${/a?/.test(y)}`;', ['? quantifier removed: x = `${/a/.test(y)}`;']],
];

const PATTERN_TEXT_ROWS = [
  ["x = new RegExp('\\\\d+?(?:a|b)', 'g');", [
    "+ quantifier removed: x = new RegExp('\\\\d?(?:a|b)', 'g');",
    "alternative removed: x = new RegExp('\\\\d+?(?:b)', 'g');",
    "alternative removed: x = new RegExp('\\\\d+?(?:a)', 'g');",
  ]],
  ["x = '^\\\\d+$';", [
    "+ quantifier removed: x = '^\\\\d$';", "anchor removed: x = '\\\\d+$';", "anchor removed: x = '^\\\\d+';",
  ]],
  ["x = '(?:a)?';", ["? quantifier removed: x = '(?:a)';"]],
  ["x = '\\\\d|x';", ["alternative removed: x = '\\\\d';"]],
  ['x = `\\\\d+ ${y} (a|b)`;', ['+ quantifier removed: x = `\\\\d ${y} (a|b)`;']],
];

const NO_PATTERN_ROWS = [
  ["x = 'Are you sure?';", []],
  ['x = \'[role="grid"]\';', []],
  ["x = 'a+b*c? (x|y) [ab] ^$';", []],
  ['x = `a+b* ${y} c?`;', []],
  ["// /a?b+/ '\\\\d*' (?:a|b)\nx;", []],
  ['/* /^a$/ [ab] */ x;', []],
];

function applyBug(text, bug) {
  return text.slice(0, bug.start) + bug.after + text.slice(bug.start + bug.before.length);
}

function plantedIn(snippet) {
  return plantBugs('snippet.js', snippet).map((bug) => `${bug.change}: ${applyBug(snippet, bug)}`).sort();
}

// Each failing parse of a file with one planted bug in it.
function parseFailures(file, text) {
  return plantBugs(file, text).flatMap((bug) => {
    try {
      new vm.Script(applyBug(text, bug));
      return [];
    } catch (error) {
      return [`${file}:${bug.line}:${bug.column} ${bug.change} "${bug.before}": ${error.message}`];
    }
  });
}

async function snippetTable(heading, rows) {
  process.stdout.write(`${heading}\n`);
  for (const [snippet, expected] of rows) {
    const result = expected.length ? expected.join(' | ') : 'no planted bug';
    await check(`plantBugs on ${snippet.replace(/\n/g, '\\n')}: ${result}`, () =>
      differs('planted bugs', plantedIn(snippet), [...expected].sort()));
  }
}

async function snippetCases() {
  await snippetTable('Pattern changes inside a regular expression literal', REGEX_LITERAL_ROWS);
  await snippetTable('Pattern changes inside string and template text that holds pattern syntax', PATTERN_TEXT_ROWS);
  await snippetTable('No planted bug in a comment, or in string or template text without pattern syntax', NO_PATTERN_ROWS);
  process.stdout.write('Each planted bug leaves the code parseable\n');
  await check('plantBugs on every snippet above: each planted bug leaves the snippet parseable', () => {
    const failures = [...REGEX_LITERAL_ROWS, ...PATTERN_TEXT_ROWS, ...NO_PATTERN_ROWS]
      .flatMap(([snippet]) => parseFailures('snippet.js', snippet));
    return failures.length ? failures.join('\n') : null;
  });
  await check('plantBugs on every JavaScript file under chrome-extension: each planted bug leaves the file parseable', () => {
    const files = childProcess.execFileSync('git', ['-C', ROOT, 'ls-files', '-z', '--', 'chrome-extension/*.js'],
      { encoding: 'utf8' }).split('\0').filter(Boolean);
    if (!files.length) return 'no JavaScript file under chrome-extension';
    const failures = files.flatMap((file) => parseFailures(file, fs.readFileSync(path.join(ROOT, file), 'utf8')));
    return failures.length ? failures.join('\n') : null;
  });
}

// Normal fixture runs end in well under LONG_RUN_MS, so a run older than
// that is a planted bug that loops forever.
const LONG_RUN_MS = 300;
const POLL_MS = 25;
const WAIT_LIMIT_MS = 15 * 1000;
// Long enough for the operating system to end a killed run and remove it.
const SETTLE_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

async function waitForLongRun(runsDir) {
  const firstSeen = new Map();
  const deadline = Date.now() + WAIT_LIMIT_MS;
  while (Date.now() < deadline) {
    const now = Date.now();
    for (const pid of fs.readdirSync(runsDir).map(Number)) {
      if (!firstSeen.has(pid)) firstSeen.set(pid, now);
      if (now - firstSeen.get(pid) >= LONG_RUN_MS && isAlive(pid)) return pid;
    }
    await sleep(POLL_MS);
  }
  return null;
}

function suiteRunPids(runsDir) {
  return fs.readdirSync(runsDir).map(Number);
}

// A failing case kills every suite run it started, so none outlives the self-test.
function killSuiteRuns(runsDir) {
  for (const pid of suiteRunPids(runsDir)) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already ended */ }
  }
}

async function signalCase(fixture) {
  await check('measure sent SIGTERM alone while a planted bug loops forever: no suite run and no worker copy is left', async () => {
    const runsDir = freshDir(fixture, 'signal-runs');
    const out = path.join(fixture.temp, 'signal-result.json');
    const script = childProcess.spawn(process.execPath, [SCRIPT, ...measureArgs(fixture, out)], {
      stdio: 'ignore',
      env: { ...process.env, TEST_RECORD_PATH: '', TMPDIR: fixture.scriptTemp, FIXTURE_RUNS_DIR: runsDir },
    });
    const exited = new Promise((resolve) => script.on('exit', resolve));
    try {
      const looping = await waitForLongRun(runsDir);
      if (looping === null) return `no suite run lasted ${LONG_RUN_MS} ms within ${WAIT_LIMIT_MS} ms`;
      script.kill('SIGTERM');
      await exited;
      await sleep(SETTLE_MS);
      const alive = suiteRunPids(runsDir).filter(isAlive);
      return alive.length ? `suite runs still going: ${alive.join(', ')}` : leftovers(fixture);
    } finally {
      killSuiteRuns(runsDir);
      if (script.exitCode === null && script.signalCode === null) {
        script.kill('SIGKILL');
        await exited;
      }
    }
  });
}

// Removes what a failing script run leaves, so the later cases start clean.
function clearLeftovers(fixture) {
  for (const name of fs.readdirSync(fixture.scriptTemp)) {
    fs.rmSync(path.join(fixture.scriptTemp, name), { recursive: true, force: true });
  }
  git(fixture.repo, 'worktree', 'prune');
}

async function badRecordCase(fixture) {
  await check('measure on a suite that writes {} as its record in one planted bug run while other runs go on: exits 2 naming the record, and no suite run, worker copy, or temporary folder is left', async () => {
    const runsDir = freshDir(fixture, 'bad-record-runs');
    const out = path.join(fixture.temp, 'bad-record-result.json');
    try {
      const run = runScript(fixture, measureArgs(fixture, out),
        { FIXTURE_RUNS_DIR: runsDir, FIXTURE_BAD_RECORD_DIR: freshDir(fixture, 'bad-record-slots') });
      await sleep(SETTLE_MS);
      const alive = suiteRunPids(runsDir).filter(isAlive);
      const problems = [
        run.status === 2 && run.stderr.includes('is not a list of { piece, line, name, passed }') ? null : exitDetail(run),
        alive.length ? `suite runs still going: ${alive.join(', ')}` : null,
        leftovers(fixture),
      ].filter(Boolean);
      return problems.join('\n') || null;
    } finally {
      killSuiteRuns(runsDir);
      clearLeftovers(fixture);
    }
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
    await snippetCases();
    const fixture = buildFixture(temp);
    const result = await measureCases(fixture);
    if (result) {
      await sortCases(fixture);
      await proveCases(fixture);
    }
    await measureFailureCases(fixture);
    await crossPieceCases(fixture);
    await patternFormCases(fixture);
    await signalCase(fixture);
    await badRecordCase(fixture);
    await extensionCase(temp);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  process.stdout.write(`${passed} passed, ${failed} failed in ${Date.now() - started} ms\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
