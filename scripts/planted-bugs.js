#!/usr/bin/env node
/**
 * Measures which planted bugs each assertion of the extension suite catches,
 * sorts the assertions by what they catch, and proves that a branch that
 * changes test pieces leaves every caught planted bug caught.
 * docs/sprint-plans/test-dedup.md, section 3, holds the design.
 * Node standard library only.
 */

'use strict';

const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CLEAN_RUNS = 3;
const TIME_CAP_MULTIPLE = 3;
// Node takes tens of milliseconds to start, and the start time varies under
// load by more than a fast suite takes to run. Without a floor, a planted
// bug in a fast suite could count as caught by a timeout by chance.
const MIN_TIME_CAP_MS = 1000;
// A clean run of the extension suite takes about 7 seconds. A clean run
// still going after 10 minutes is stuck, and the script stops with an error.
const CLEAN_RUN_TIME_CAP_MS = 10 * 60 * 1000;
const MAX_PLANTED_BUGS = 10000;
const PROGRESS_EVERY = 100;
// One core stays free for the computer.
const WORKERS = Math.max(1, os.availableParallelism() - 1);

// The suite measure runs by default. A --suite file holds the same three
// fields for another suite. Paths are from the repository root; a path in a
// list stands for the file or every file under the folder.
//   command      runs the suite from the root of a worker copy
//   productDir   product code: every file under it outside testPaths
//   testPaths    the runner and the test pieces
const EXTENSION_SUITE = {
  command: ['node', 'chrome-extension/tests.js'],
  productDir: 'chrome-extension',
  testPaths: ['chrome-extension/tests.js', 'chrome-extension/tests'],
};

const USAGE = `Usage, from any directory:
  node scripts/planted-bugs.js measure --out <file> [--commit <ref>] [--files <paths>] [--root <dir>] [--suite <file>]
  node scripts/planted-bugs.js sort --in <file>
  node scripts/planted-bugs.js prove --in <file> --branch <ref> [--root <dir>]

measure  Runs the clean suite ${CLEAN_RUNS} times, then the suite once per planted
         bug, at the commit (default HEAD), and writes the result file.
         --files holds comma-separated product files to plant bugs in
         (default: every product file).
sort     Prints, by piece, the assertions that catch nothing, the ones that
         repeat others, the unique ones, and the flaky ones.
prove    Reruns every planted bug the result file holds as caught, at the
         branch's commit, and exits 1 unless each one is still caught.
         Exits 1 with "measure again" when the branch changes product code.

--root <dir>    the repository (default: the one holding this script)
--suite <file>  a JSON file describing another suite, with the fields of
                EXTENSION_SUITE in this script (default: the extension
                suite). The result file holds the suite, so sort and prove
                read it from there.

The script runs the suite command with TEST_RECORD_PATH set to a file path.
The suite writes there a JSON list with one entry per assertion:
{ piece, line, name, passed }, where piece and line locate the call site and
piece is a path from the repository root.

Exit codes: 0 success, 1 a failed proof, 2 an error.`;

// No assertion gets credit for a 'crash' or a 'timeout'. An 'invalid'
// planted bug stopped the suite before its first assertion; measure counts
// it and uses it nowhere.
const CAUGHT_OUTCOMES = new Set(['assertions', 'crash', 'timeout']);

class ScriptError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.exitCode = exitCode;
  }
}

// --- Arguments, git, and the suite description ---

const MODE_OPTIONS = {
  measure: { required: ['out'], optional: ['commit', 'files', 'root', 'suite'] },
  sort: { required: ['in'], optional: [] },
  prove: { required: ['in', 'branch'], optional: ['root'] },
};

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const allowed = MODE_OPTIONS[mode];
  if (!allowed) throw new ScriptError(`unknown mode "${mode || ''}"\n\n${USAGE}`);
  const options = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i].replace(/^--/, '');
    const known = rest[i].startsWith('--') && [...allowed.required, ...allowed.optional].includes(key);
    if (!known || rest[i + 1] === undefined) {
      throw new ScriptError(`${mode} does not take "${rest[i]}" there\n\n${USAGE}`);
    }
    options[key] = rest[i + 1];
  }
  const missing = allowed.required.filter((key) => options[key] === undefined);
  if (missing.length) throw new ScriptError(`${mode} needs --${missing.join(' and --')}\n\n${USAGE}`);
  return { mode, options };
}

function git(root, ...args) {
  try {
    return execFileSync('git', ['-C', root, ...args],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    throw new ScriptError(`git ${args.join(' ')} failed: ${String(error.stderr || error.message).trim()}`);
  }
}

function resolveCommit(root, ref) {
  return git(root, 'rev-parse', '--verify', `${ref}^{commit}`).trim();
}

function isUnder(file, folder) {
  return folder === '.' || file === folder || file.startsWith(`${folder}/`);
}

function isTestPath(suite, file) {
  return suite.testPaths.some((testPath) => isUnder(file, testPath));
}

function isProductPath(suite, file) {
  return isUnder(file, suite.productDir) && !isTestPath(suite, file);
}

function checkSuite(suite, source) {
  const isText = (value) => typeof value === 'string' && value.length > 0;
  const isTextList = (value) => Array.isArray(value) && value.every(isText);
  const valid = suite && isTextList(suite.command) && suite.command.length > 0 &&
    isText(suite.productDir) && isTextList(suite.testPaths);
  if (!valid) {
    throw new ScriptError(`${source} must hold command (a list of strings), productDir, and testPaths`);
  }
  const trim = (file) => file.replace(/\/+$/, '');
  return {
    command: suite.command,
    productDir: trim(suite.productDir),
    testPaths: suite.testPaths.map(trim),
  };
}

function readJson(file, what) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new ScriptError(`cannot read the ${what} ${file}: ${error.message}`);
  }
}

// --- The lexer ---

// Longest first, so the lexer takes "!==" before "!=" and "!".
const PUNCTUATORS = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=',
  '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=',
  '&=', '|=', '^=', '**', '<<', '>>'];
const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete',
  'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
const NAME = /[A-Za-z_$\u0080-\uFFFF][\w$\u0080-\uFFFF]*/y;
const NUMBER = /(?:0[xXoObB][\da-fA-F_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)n?/y;

function matchAt(pattern, text, index) {
  pattern.lastIndex = index;
  const match = pattern.exec(text);
  return match ? match[0] : null;
}

function skipQuoted(text, index) {
  const quote = text[index];
  let i = index + 1;
  while (i < text.length && text[i] !== quote && text[i] !== '\n') i += text[i] === '\\' ? 2 : 1;
  return i + 1;
}

// Returns the index after the closing backtick, or after a "${" with
// `opensExpression` set.
function skipTemplateText(text, index) {
  let i = index;
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue; }
    if (text[i] === '`') return { end: i + 1, opensExpression: false };
    if (text.startsWith('${', i)) return { end: i + 2, opensExpression: true };
    i++;
  }
  return { end: i, opensExpression: false };
}

// A regular expression never spans lines, so a slash whose expression would
// run past the line end is division, and the lexer gets -1.
function skipRegex(text, index) {
  let i = index + 1;
  let inClass = false;
  while (i < text.length && text[i] !== '\n') {
    if (text[i] === '\\') { i += 2; continue; }
    if (text[i] === '[') inClass = true;
    else if (text[i] === ']') inClass = false;
    else if (text[i] === '/' && !inClass) return i + 1 + (matchAt(/[a-z]*/y, text, i + 1) || '').length;
    i++;
  }
  return -1;
}

function regexAllowedAfter(token) {
  if (!token) return true;
  if (token.type === 'name') return KEYWORDS_BEFORE_REGEX.has(token.text);
  if (token.type === 'punct') return ![')', ']', '}'].includes(token.text);
  return false;
}

// Comments, string text, template text, and regular expressions yield no
// code token, so no planted bug lands in them. Each string, template, and
// regular expression yields one 'literal' token, so the lexer treats a slash
// after it as division.
function lexCode(text) {
  const tokens = [];
  const templateBraces = [];
  let i = 0;
  const push = (type, tokenText, start) => tokens.push({ type, text: tokenText, start });
  const resumeTemplate = (from) => {
    const { end, opensExpression } = skipTemplateText(text, from);
    if (opensExpression) { templateBraces.push(0); push('punct', '${', end - 2); } else push('literal', '', from);
    return end;
  };
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (text.startsWith('//', i)) { const end = text.indexOf('\n', i); i = end < 0 ? text.length : end; continue; }
    if (text.startsWith('/*', i)) { const end = text.indexOf('*/', i + 2); i = end < 0 ? text.length : end + 2; continue; }
    if (ch === '"' || ch === "'") { push('literal', '', i); i = skipQuoted(text, i); continue; }
    if (ch === '`') { i = resumeTemplate(i + 1); continue; }
    if (ch === '/' && regexAllowedAfter(tokens[tokens.length - 1])) {
      const end = skipRegex(text, i);
      if (end > 0) { push('literal', '', i); i = end; continue; }
    }
    const number = /\d/.test(ch) || (ch === '.' && /\d/.test(text[i + 1] || '')) ? matchAt(NUMBER, text, i) : null;
    if (number) { push('number', number, i); i += number.length; continue; }
    const name = matchAt(NAME, text, i);
    if (name) { push('name', name, i); i += name.length; continue; }
    if (templateBraces.length && (ch === '{' || ch === '}')) {
      const depth = templateBraces.length - 1;
      if (ch === '}' && templateBraces[depth] === 0) { templateBraces.pop(); i = resumeTemplate(i + 1); continue; }
      templateBraces[depth] += ch === '{' ? 1 : -1;
    }
    const punct = PUNCTUATORS.find((p) => text.startsWith(p, i) && !(p === '?.' && /\d/.test(text[i + 2] || ''))) || ch;
    push('punct', punct, i);
    i += punct.length;
  }
  return tokens;
}

// --- The planted bug table ---

function edit(start, end, after) {
  return { start, end, after };
}

function swap(from, to) {
  return {
    change: `${from} to ${to}`,
    plant: (tokens, i) => {
      const token = tokens[i];
      const isProperty = token.type === 'name' && i > 0 && ['.', '?.'].includes(tokens[i - 1].text);
      return token.text === from && token.type !== 'literal' && !isProperty
        ? [edit(token.start, token.start + from.length, to)] : [];
    },
  };
}

function forceIfCondition(value) {
  return {
    change: `if condition to ${value}`,
    plant: (tokens, i) => {
      if (tokens[i].type !== 'name' || tokens[i].text !== 'if' || (tokens[i + 1] || {}).text !== '(') return [];
      let depth = 0;
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type !== 'punct') continue;
        if (tokens[j].text === '(') depth++;
        if (tokens[j].text === ')' && --depth === 0) return [edit(tokens[i + 1].start + 1, tokens[j].start, value)];
      }
      return [];
    },
  };
}

const PLANTED_BUG_CHANGES = [
  swap('<', '<='), swap('<=', '<'), swap('>', '>='), swap('>=', '>'),
  swap('===', '!=='), swap('!==', '==='),
  swap('&&', '||'), swap('||', '&&'),
  swap('true', 'false'), swap('false', 'true'),
  {
    change: 'leading ! removed',
    plant: (tokens, i) => (tokens[i].type === 'punct' && tokens[i].text === '!'
      ? [edit(tokens[i].start, tokens[i].start + 1, '')] : []),
  },
  {
    change: 'n to n + 1',
    plant: (tokens, i) => {
      const token = tokens[i];
      const value = token.type === 'number' && !token.text.endsWith('n') ? Number(token.text.replace(/_/g, '')) : NaN;
      return Number.isFinite(value) ? [edit(token.start, token.start + token.text.length, String(value + 1))] : [];
    },
  },
  forceIfCondition('true'),
  forceIfCondition('false'),
];

function lineAndColumn(text, index) {
  const before = text.slice(0, index).split('\n');
  return { line: before.length, column: before[before.length - 1].length + 1 };
}

function plantBugs(file, text) {
  const tokens = lexCode(text);
  const bugs = [];
  tokens.forEach((token, i) => {
    for (const { change, plant } of PLANTED_BUG_CHANGES) {
      for (const { start, end, after } of plant(tokens, i)) {
        const before = text.slice(start, end);
        if (before !== after) bugs.push({ file, ...lineAndColumn(text, start), start, before, after, change });
      }
    }
  });
  return bugs;
}

function listPlantedBugs(root, commit, suite, filesOption) {
  const productFiles = git(root, 'ls-tree', '-r', '-z', '--name-only', commit, '--', suite.productDir)
    .split('\0').filter((file) => file.endsWith('.js') && isProductPath(suite, file));
  const files = filesOption ? filesOption.split(',').map((file) => file.trim()) : productFiles;
  const outside = files.filter((file) => !productFiles.includes(file));
  if (outside.length) throw new ScriptError(`not a product file at ${commit}: ${outside.join(', ')}`);
  if (!files.length) throw new ScriptError(`no product files under ${suite.productDir} at ${commit}`);
  const bugs = files.flatMap((file) => plantBugs(file, git(root, 'show', `${commit}:${file}`)));
  return bugs.map((bug, id) => ({ id, ...bug }));
}

// --- Worker copies and suite runs ---

// An interrupt sent to the script alone, or an error that ends the script,
// would leave the suite runs going, and a run of a planted bug that loops
// forever would never end. The script stops each one before it exits.
const liveRuns = new Set();

function stopLiveRuns() {
  for (const child of liveRuns) child.kill('SIGKILL');
  liveRuns.clear();
}

async function withWorkerCopies(root, commit, count, work) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'planted-bugs-'));
  const copies = [];
  const remove = () => {
    stopLiveRuns();
    for (const copy of copies) {
      try { git(root, 'worktree', 'remove', '--force', copy.dir); } catch { /* the prune below clears it */ }
    }
    fs.rmSync(folder, { recursive: true, force: true });
    try { git(root, 'worktree', 'prune'); } catch (error) { console.error(`planted-bugs: ${error.message}`); }
  };
  const onSignal = () => { remove(); process.exit(130); };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  process.on('SIGHUP', onSignal);
  try {
    for (let i = 0; i < count; i++) {
      const dir = path.join(folder, `worker-${i}`);
      git(root, 'worktree', 'add', '--detach', '--quiet', dir, commit);
      copies.push({ dir, record: path.join(folder, `record-${i}.json`) });
    }
    return await work(copies);
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    process.off('SIGHUP', onSignal);
    remove();
  }
}

function isRecordEntry(entry) {
  return entry && typeof entry.piece === 'string' && Number.isInteger(entry.line) &&
    typeof entry.name === 'string' && typeof entry.passed === 'boolean';
}

// A run that stops before the process exit writes no record, so a missing or
// unreadable file stands for a run with no assertions.
function readRecord(file) {
  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  if (!Array.isArray(entries) || !entries.every(isRecordEntry)) {
    throw new ScriptError(`the record ${file} is not a list of { piece, line, name, passed }`);
  }
  return entries;
}

function runSuiteOnce(copy, command, timeCapMs) {
  fs.rmSync(copy.record, { force: true });
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(command[0], command.slice(1),
      { cwd: copy.dir, env: { ...process.env, TEST_RECORD_PATH: copy.record }, stdio: 'ignore' });
    liveRuns.add(child);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeCapMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      liveRuns.delete(child);
      reject(new ScriptError(`cannot run ${command.join(' ')}: ${error.message}`));
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      liveRuns.delete(child);
      try {
        const entries = timedOut ? null : readRecord(copy.record);
        resolve({ timedOut, exitCode, elapsedMs: Date.now() - started, entries });
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function runPool(copies, items, task) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(copies.map(async (copy) => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(copy, items[index], index);
    }
  }));
  return results;
}

// --- Assertion identities and outcomes ---

// An identity is the piece, line, and name; a repeat within one run gets
// "#2", "#3". The site, the piece and line with a count, finds the clean
// assertion when a planted bug changes a value the name holds.
function identify(entries) {
  const counts = new Map();
  const next = (key) => { const n = (counts.get(key) || 0) + 1; counts.set(key, n); return n; };
  return entries.map((entry) => {
    const base = `${entry.piece}:${entry.line} ${entry.name}`;
    const occurrence = next(`id ${base}`);
    return {
      ...entry,
      id: occurrence === 1 ? base : `${base} #${occurrence}`,
      site: `${entry.piece}:${entry.line} #${next(`site ${entry.piece}:${entry.line}`)}`,
    };
  });
}

function summarizeCleanRuns(runs, command) {
  const commandText = command.join(' ');
  for (const run of runs) {
    if (run.timedOut) throw new ScriptError(`a clean run of ${commandText} exceeded ${CLEAN_RUN_TIME_CAP_MS} ms`);
    if (!run.entries || !run.entries.length) {
      throw new ScriptError(`a clean run of ${commandText} stopped before its first assertion (exit code ${run.exitCode})`);
    }
    if (run.exitCode !== 0 && run.entries.every((entry) => entry.passed)) {
      throw new ScriptError(`a clean run of ${commandText} exited with code ${run.exitCode} with every assertion passing`);
    }
  }
  const byId = new Map();
  for (const entry of runs.flatMap((run) => identify(run.entries))) {
    const known = byId.get(entry.id) || { ...entry, runs: 0, passes: 0 };
    byId.set(entry.id, { ...known, runs: known.runs + 1, passes: known.passes + (entry.passed ? 1 : 0) });
  }
  const assertions = [...byId.values()].map(({ id, piece, line, name, site, runs: seen, passes }) => ({
    id, piece, line, name, site,
    flaky: !(passes === runs.length && seen === runs.length),
    broken: passes === 0 && seen === runs.length,
  }));
  const broken = assertions.filter((assertion) => assertion.broken);
  if (broken.length) {
    throw new ScriptError(`the clean suite fails in every run:\n  ${broken.map((assertion) => assertion.id).join('\n  ')}`);
  }
  const stable = assertions.filter((assertion) => !assertion.flaky);
  const slowestMs = Math.max(...runs.map((run) => run.elapsedMs));
  return {
    assertions: assertions.map(({ broken: _, site: __, ...assertion }) => assertion),
    stableIds: new Set(stable.map((assertion) => assertion.id)),
    flakyIds: new Set(assertions.filter((assertion) => assertion.flaky).map((assertion) => assertion.id)),
    idAtSite: new Map(stable.map((assertion) => [assertion.site, assertion.id])),
    entryCount: Math.min(...runs.map((run) => run.entries.length)),
    cleanRunMs: runs.map((run) => run.elapsedMs),
    timeCapMs: Math.max(MIN_TIME_CAP_MS, TIME_CAP_MULTIPLE * slowestMs),
  };
}

function classify(run, clean) {
  if (run.timedOut) return { outcome: 'timeout', credited: [] };
  if (!run.entries || !run.entries.length) return { outcome: 'invalid', credited: [] };
  const failed = identify(run.entries).filter((entry) => !entry.passed);
  const failing = failed.filter((entry) => !clean.flakyIds.has(entry.id));
  const credited = new Set();
  let unmatched = 0;
  for (const entry of failing) {
    const id = clean.stableIds.has(entry.id) ? entry.id : clean.idAtSite.get(entry.site);
    if (id === undefined) unmatched++; else credited.add(id);
  }
  if (credited.size) return { outcome: 'assertions', credited: [...credited] };
  // A failing assertion with no clean identity can take no credit, so the
  // planted bug counts as caught by a crash. A failing flaky assertion
  // accounts for a non-zero exit, so it is no crash.
  const stoppedEarly = run.exitCode !== 0 && (run.entries.length < clean.entryCount || !failed.length);
  return { outcome: unmatched || stoppedEarly ? 'crash' : 'not caught', credited: [] };
}

async function runCleanSuite(copies, suite) {
  const runs = await runPool(copies, new Array(CLEAN_RUNS).fill(null),
    (copy) => runSuiteOnce(copy, suite.command, CLEAN_RUN_TIME_CAP_MS));
  return summarizeCleanRuns(runs, suite.command);
}

async function runPlantedBug(copy, bug, suite, clean) {
  const file = path.join(copy.dir, bug.file);
  const original = fs.readFileSync(file, 'utf8');
  if (original.slice(bug.start, bug.start + bug.before.length) !== bug.before) {
    throw new ScriptError(`planted bug ${bug.id} no longer matches ${bug.file}:${bug.line}:${bug.column}`);
  }
  fs.writeFileSync(file, original.slice(0, bug.start) + bug.after + original.slice(bug.start + bug.before.length));
  try {
    return classify(await runSuiteOnce(copy, suite.command, clean.timeCapMs), clean);
  } finally {
    fs.writeFileSync(file, original);
  }
}

async function runPlantedBugs(copies, bugs, suite, clean) {
  let done = 0;
  return runPool(copies, bugs, async (copy, bug) => {
    const result = await runPlantedBug(copy, bug, suite, clean);
    done++;
    if (done % PROGRESS_EVERY === 0 || done === bugs.length) console.error(`planted bugs run: ${done} of ${bugs.length}`);
    return result;
  });
}

function workerCount(taskCount) {
  return Math.min(WORKERS, Math.max(CLEAN_RUNS, taskCount));
}

// --- The three modes ---

// measure writes the result file after a run of up to an hour, so a path it
// cannot write fails before the first run.
function checkWritable(file) {
  try {
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    if (stat && stat.isDirectory()) throw new Error('it is a folder');
    fs.accessSync(stat ? file : path.dirname(path.resolve(file)), fs.constants.W_OK);
  } catch (error) {
    throw new ScriptError(`cannot write the result file ${file}: ${error.message}`);
  }
}

async function measure(options) {
  checkWritable(options.out);
  const root = path.resolve(options.root || path.join(__dirname, '..'));
  const suite = checkSuite(options.suite ? readJson(options.suite, 'suite file') : EXTENSION_SUITE,
    options.suite || 'EXTENSION_SUITE');
  const commit = resolveCommit(root, options.commit || 'HEAD');
  const bugs = listPlantedBugs(root, commit, suite, options.files);
  if (bugs.length > MAX_PLANTED_BUGS) {
    throw new ScriptError(`${bugs.length} planted bugs exceed the cap of ${MAX_PLANTED_BUGS}; the list of changes matches too broadly`);
  }
  const started = Date.now();
  const workers = workerCount(bugs.length);
  const { clean, results } = await withWorkerCopies(root, commit, workers, async (copies) => {
    const cleanSummary = await runCleanSuite(copies, suite);
    return { clean: cleanSummary, results: await runPlantedBugs(copies, bugs, suite, cleanSummary) };
  });
  const catches = new Map(clean.assertions.map((assertion) => [assertion.id, []]));
  results.forEach(({ credited }, id) => credited.forEach((assertionId) => catches.get(assertionId).push(id)));
  const outcomes = {};
  results.forEach(({ outcome }) => { outcomes[outcome] = (outcomes[outcome] || 0) + 1; });
  const result = {
    commit, suite, workers, cleanRunMs: clean.cleanRunMs, timeCapMs: clean.timeCapMs,
    elapsedMs: Date.now() - started, outcomes,
    plantedBugs: bugs.map((bug, id) => ({ ...bug, outcome: results[id].outcome })),
    assertions: clean.assertions.map((assertion) => ({ ...assertion, catches: catches.get(assertion.id) })),
    repeatedIdentities: clean.assertions.filter((assertion) => / #\d+$/.test(assertion.id)).map((assertion) => assertion.id),
  };
  fs.writeFileSync(options.out, `${JSON.stringify(result, null, 2)}\n`);
  const perBug = bugs.length ? Math.round(result.elapsedMs / bugs.length) : 0;
  console.log(`${bugs.length} planted bugs in ${Math.round(result.elapsedMs / 1000)} s with ${workers} workers, ` +
    `${perBug} ms each; outcomes ${JSON.stringify(outcomes)}; written to ${options.out}`);
}

function readResult(file) {
  const result = readJson(file, 'result file');
  if (!result || typeof result.commit !== 'string' || !Array.isArray(result.plantedBugs) || !Array.isArray(result.assertions)) {
    throw new ScriptError(`${file} is not a result file of measure`);
  }
  return { ...result, suite: checkSuite(result.suite, `the suite in ${file}`) };
}

// Pieces sort by their first assertion in the record, which follows the
// order list. Each drop updates the kept set before the next assertion, so of
// two assertions that only repeat each other, one stays.
function sortAssertions(assertions) {
  const pieceOrder = [...new Set(assertions.map((assertion) => assertion.piece))];
  const ordered = assertions.map((assertion, index) => ({ assertion, index }))
    .sort((a, b) => pieceOrder.indexOf(a.assertion.piece) - pieceOrder.indexOf(b.assertion.piece) ||
      a.assertion.line - b.assertion.line || a.index - b.index)
    .map(({ assertion }) => assertion);
  const measured = ordered.filter((assertion) => !assertion.flaky);
  const keptCatchers = new Map();
  for (const bug of measured.flatMap((assertion) => assertion.catches)) keptCatchers.set(bug, (keptCatchers.get(bug) || 0) + 1);
  const lists = { 'catches nothing': [], 'repeats others': [], unique: [], flaky: ordered.filter((assertion) => assertion.flaky) };
  for (const assertion of measured) {
    if (!assertion.catches.length) { lists['catches nothing'].push(assertion); continue; }
    if (assertion.catches.every((bug) => keptCatchers.get(bug) > 1)) {
      assertion.catches.forEach((bug) => keptCatchers.set(bug, keptCatchers.get(bug) - 1));
      lists['repeats others'].push(assertion);
    } else {
      lists.unique.push(assertion);
    }
  }
  return lists;
}

function sort(options) {
  const lists = sortAssertions(readResult(options.in).assertions);
  for (const [title, assertions] of Object.entries(lists)) {
    console.log(`${title} (${assertions.length})`);
    let piece = null;
    for (const assertion of assertions) {
      if (assertion.piece !== piece) { piece = assertion.piece; console.log(`  ${piece}`); }
      console.log(`    ${assertion.line}  ${assertion.name}`);
    }
  }
}

// Each lost planted bug comes with the assertions that caught it in the
// result file, so a reader can find the cleanup that lost it.
function describeLost(result, lost) {
  const catchers = new Map();
  for (const assertion of result.assertions) {
    for (const bug of assertion.catches) catchers.set(bug, [...(catchers.get(bug) || []), assertion]);
  }
  return lost.flatMap((bug) => [
    `  planted bug ${bug.id}: ${bug.file}:${bug.line}:${bug.column} ${bug.change}, caught by ` +
      (bug.outcome === 'assertions' ? 'assertions' : `a ${bug.outcome}`),
    ...(catchers.get(bug.id) || []).map((assertion) => `    ${assertion.piece}:${assertion.line}  ${assertion.name}`),
  ]);
}

// The joined suite is one scope, and some assertions read files outside the
// test pieces, so a branch that changes any test file can change what any
// assertion checks. prove therefore reruns every caught planted bug.
async function prove(options) {
  const root = path.resolve(options.root || path.join(__dirname, '..'));
  const result = readResult(options.in);
  const branch = resolveCommit(root, options.branch);
  const changed = git(root, 'diff', '--name-only', '--no-renames', '-z', result.commit, branch).split('\0').filter(Boolean);
  const productChanges = changed.filter((file) => isProductPath(result.suite, file));
  if (productChanges.length) {
    throw new ScriptError(`the branch changes product code (${productChanges.join(', ')}); measure again`, 1);
  }
  const reruns = result.plantedBugs.filter((bug) => CAUGHT_OUTCOMES.has(bug.outcome));
  const outcomes = await withWorkerCopies(root, branch, workerCount(reruns.length), async (copies) => {
    const clean = await runCleanSuite(copies, result.suite);
    return runPlantedBugs(copies, reruns, result.suite, clean);
  });
  const lost = reruns.filter((bug, index) => outcomes[index].outcome === 'not caught');
  if (lost.length) {
    const lines = describeLost(result, lost);
    throw new ScriptError(`${lost.length} of ${reruns.length} rerun planted bugs are no longer caught:\n${lines.join('\n')}`, 1);
  }
  console.log(`proved: ${reruns.length} rerun planted bugs are still caught`);
}

async function main() {
  try {
    const { mode, options } = parseArgs(process.argv.slice(2));
    await { measure, sort, prove }[mode](options);
  } catch (error) {
    if (!(error instanceof ScriptError)) throw error;
    console.error(`planted-bugs: ${error.message}`);
    process.exitCode = error.exitCode;
  }
}

main();
