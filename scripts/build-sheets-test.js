#!/usr/bin/env node
/**
 * Self-test for scripts/build-sheets.js, the Sheets build.
 *
 * The committed Sheets library is the build's output, so these cases check
 * the build and its check from outside: the committed file matches a build of
 * the committed sources, the check fails on every kind of stale file and
 * names the build command, and the built file runs as one Apps Script file.
 *
 * Cases that edit a source run in a scratch copy of the build script and its
 * sources, so the real tree never changes. The list of shared library files
 * comes from the section markers in the built file, which the build writes
 * from its own list; a built file with no marker fails the run.
 *
 * Run with no arguments; exits 0 when the build behaves and 1 when any case
 * fails. Node standard library only.
 */

'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const BUILD = 'scripts/build-sheets.js';
const BUILD_COMMAND = 'node ' + BUILD;
const OUTPUT = 'js/round_dynamic.js';
const HEADER = 'js/src/header.js';
const ENTRY = 'js/src/entry.js';
const SECTION_MARKER = /^\/\/ ---- (\S+) ----$/gm;
// Identifiers a file that Apps Script runs as one script may not reference:
// Node's module system, ES modules, and Node's process object.
const FORBIDDEN_IDENTIFIERS = ['require', 'import', 'export', 'module', 'exports', 'process'];

let passed = 0;
let failed = 0;
const scratchDirs = [];

function recordPass(name) {
  passed++;
  process.stdout.write('  pass  ' + name + '\n');
}

function recordFail(name, detail) {
  failed++;
  process.stdout.write('  FAIL  ' + name + '\n        ' + detail + '\n');
}

// Runs one case: the body returns nothing on a pass and a failure detail
// string, or throws, on a failure.
function check(name, body) {
  let detail;
  try {
    detail = body();
  } catch (err) {
    detail = 'threw: ' + err.message;
  }
  if (detail) recordFail(name, detail);
  else recordPass(name);
}

function readRoot(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}

// The shared library files the build includes, read from the section markers
// in a built file. Every marker but the entry source's names one.
function libraryFiles(built) {
  const files = [...built.matchAll(SECTION_MARKER)].map((m) => m[1]);
  if (files.length === 0 || files[files.length - 1] !== ENTRY) {
    throw new Error('the built file holds no section marker for ' + ENTRY);
  }
  const library = files.slice(0, -1);
  if (library.length === 0) {
    throw new Error('the built file holds no section marker for a shared library file');
  }
  return library;
}

function sourceFiles(built) {
  return [BUILD, HEADER, ...libraryFiles(built), ENTRY];
}

// Writes a scratch tree with the given files, read through the reader, and
// returns its path.
function scratchTree(files, read) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-sheets-test.'));
  scratchDirs.push(dir);
  for (const name of files) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, read(name));
  }
  return dir;
}

// A scratch copy of the working tree's build script, sources, and committed
// built file.
function workingCopy() {
  const built = readRoot(OUTPUT);
  return scratchTree([...sourceFiles(built), OUTPUT], readRoot);
}

function runBuild(dir, args, cwd) {
  return childProcess.spawnSync(process.execPath, [path.join(dir, BUILD), ...args], {
    cwd: cwd || dir,
    encoding: 'utf8',
  });
}

function appendLine(file, line) {
  fs.appendFileSync(file, line + '\n');
}

// ---- Reading JavaScript ----------------------------------------------------

const REGEX_AFTER_WORD = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await',
]);

// Splits source into code tokens: identifiers and keywords as words, every
// other code character as a punctuator. Comments, strings, template text, and
// regular expression literals produce no tokens, so a word inside one is
// never read as code. Each token carries the count of brackets open around it.
function tokenize(source) {
  const tokens = [];
  const stack = [];
  let i = 0;
  let prev = null;

  function push(type, value) {
    const token = { type, value, depth: stack.length };
    tokens.push(token);
    prev = token;
  }

  function regexAllowed() {
    if (prev === null) return true;
    if (prev.type === 'word') return REGEX_AFTER_WORD.has(prev.value);
    if (prev.type === 'literal') return false;
    return !(prev.value === ')' || prev.value === ']' || prev.value === '}');
  }

  function skipQuoted(quote) {
    i++;
    while (i < source.length && source[i] !== quote) {
      if (source[i] === '\\') i++;
      if (source[i] === '\n') throw new Error('unterminated string at offset ' + i);
      i++;
    }
    i++;
  }

  function skipRegex() {
    i++;
    let inClass = false;
    while (i < source.length) {
      const ch = source[i];
      if (ch === '\\') { i += 2; continue; }
      if (ch === '\n') throw new Error('unterminated regular expression at offset ' + i);
      if (ch === '[') inClass = true;
      else if (ch === ']') inClass = false;
      else if (ch === '/' && !inClass) break;
      i++;
    }
    i++;
    while (i < source.length && /[a-z]/i.test(source[i])) i++;
  }

  // Skips template text up to its closing backtick or to a "${", which opens
  // a template brace on the stack.
  function skipTemplateText() {
    while (i < source.length) {
      const ch = source[i];
      if (ch === '\\') { i += 2; continue; }
      if (ch === '`') { i++; return; }
      if (ch === '$' && source[i + 1] === '{') {
        i += 2;
        stack.push('${');
        prev = null;
        return;
      }
      i++;
    }
    throw new Error('unterminated template literal');
  }

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) throw new Error('unterminated comment at offset ' + i);
      i = end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      skipQuoted(ch);
      push('literal', 'string');
      continue;
    }
    if (ch === '`') {
      i++;
      skipTemplateText();
      if (stack[stack.length - 1] !== '${') push('literal', 'template');
      continue;
    }
    if (ch === '/' && regexAllowed()) {
      skipRegex();
      push('literal', 'regex');
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let end = i + 1;
      while (end < source.length && /[\w$]/.test(source[end])) end++;
      push('word', source.slice(i, end));
      i = end;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(next || ''))) {
      let end = i + 1;
      while (end < source.length && /[\w.]/.test(source[end])) end++;
      push('literal', 'number');
      i = end;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      push('punct', ch);
      stack.push(ch);
      i++;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      const open = stack.pop();
      if (open === undefined) throw new Error('unbalanced ' + ch + ' at offset ' + i);
      i++;
      if (open === '${') {
        skipTemplateText();
        if (stack[stack.length - 1] !== '${') push('literal', 'template');
        continue;
      }
      push('punct', ch);
      continue;
    }
    push('punct', ch);
    i++;
  }
  if (stack.length !== 0) throw new Error('unbalanced brackets at end of file');
  return tokens;
}

// The names a script declares at its top level, in order, with repeats:
// function, class, const, let, and var declarations outside every bracket.
// A destructuring declaration throws, because this read cannot list its names.
function topLevelNames(source) {
  const tokens = tokenize(source);
  const names = [];
  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t];
    if (token.type !== 'word' || token.depth !== 0) continue;
    if (token.value === 'function' || token.value === 'class') {
      let n = t + 1;
      if (tokens[n] && tokens[n].value === '*') n++;
      if (tokens[n] && tokens[n].type === 'word') names.push(tokens[n].value);
      continue;
    }
    if (token.value !== 'const' && token.value !== 'let' && token.value !== 'var') continue;
    let n = t + 1;
    for (;;) {
      const name = tokens[n];
      if (!name || name.type !== 'word') {
        throw new Error('a ' + token.value + ' declaration this read cannot list');
      }
      names.push(name.value);
      n++;
      while (tokens[n] && !(tokens[n].depth === 0 && (tokens[n].value === ',' || tokens[n].value === ';'))) n++;
      if (!tokens[n] || tokens[n].value === ';') break;
      n++;
    }
    t = n;
  }
  return names;
}

function repeats(names) {
  const seen = new Set();
  const repeated = new Set();
  for (const name of names) {
    if (seen.has(name)) repeated.add(name);
    seen.add(name);
  }
  return [...repeated];
}

// ---- Cases -----------------------------------------------------------------

function cleanCheckoutCases() {
  check('a build of the committed sources is byte-identical to the committed Sheets file', () => {
    const show = (name) => childProcess.execFileSync('git', ['-C', ROOT, 'show', 'HEAD:' + name],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    const committed = show(OUTPUT);
    const dir = scratchTree(sourceFiles(committed.toString('utf8')), show);
    const result = runBuild(dir, []);
    if (result.status !== 0) return 'the build exited ' + result.status + ': ' + result.stderr;
    if (!fs.readFileSync(path.join(dir, OUTPUT)).equals(committed)) {
      return 'the built file differs from the committed one';
    }
    const again = runBuild(dir, ['--check']);
    if (again.status !== 0) return 'the check exited ' + again.status + ' after a build';
    return null;
  });

  check('the check exits zero on the working tree', () => {
    const result = runBuild(ROOT, ['--check']);
    return result.status === 0 ? null : 'the check exited ' + result.status + ': ' + result.stderr;
  });

  check('the build writes the same file from any directory', () => {
    const dir = workingCopy();
    const before = fs.readFileSync(path.join(dir, OUTPUT));
    const result = runBuild(dir, [], os.tmpdir());
    if (result.status !== 0) return 'the build exited ' + result.status + ': ' + result.stderr;
    return fs.readFileSync(path.join(dir, OUTPUT)).equals(before) ? null : 'the built file changed';
  });
}

// Requires the check to fail on a scratch tree, to name the build command,
// and to leave the stale file as it found it.
function expectStale(name, edit) {
  check(name, () => {
    const dir = workingCopy();
    edit(dir);
    const output = path.join(dir, OUTPUT);
    const before = fs.existsSync(output) ? fs.readFileSync(output) : null;
    const result = runBuild(dir, ['--check']);
    if (result.status === 0) return 'the check exited 0';
    if (!(result.stdout + result.stderr).includes(BUILD_COMMAND)) {
      return 'the message does not name `' + BUILD_COMMAND + '`: ' + result.stderr;
    }
    const after = fs.existsSync(output) ? fs.readFileSync(output) : null;
    if (String(before) !== String(after)) return 'the check wrote the Sheets file';
    return null;
  });
}

function staleCases() {
  const library = libraryFiles(readRoot(OUTPUT));
  for (const file of library) {
    expectStale('an edit to the shared library file ' + file + ' without a rebuild fails the check',
      (dir) => appendLine(path.join(dir, file), '// an edit with no rebuild'));
  }
  expectStale('an edit to the Sheets entry source without a rebuild fails the check',
    (dir) => appendLine(path.join(dir, ENTRY), '// an edit with no rebuild'));
  expectStale('an edit to the license header without a rebuild fails the check',
    (dir) => appendLine(path.join(dir, HEADER), '// an edit with no rebuild'));
  expectStale('a hand edit to the Sheets file fails the check',
    (dir) => appendLine(path.join(dir, OUTPUT), '// a hand edit'));
  expectStale('a version change in the Sheets entry source without a rebuild fails the check', (dir) => {
    const file = path.join(dir, ENTRY);
    const text = fs.readFileSync(file, 'utf8');
    const changed = text.replace(/^ \* \[VERSION\] .*$/m, ' * [VERSION] 9.9.9');
    if (changed === text) throw new Error('the Sheets entry source holds no [VERSION] line');
    fs.writeFileSync(file, changed);
  });
  expectStale('a missing Sheets file fails the check',
    (dir) => fs.rmSync(path.join(dir, OUTPUT)));

  check('a rebuild after a source edit passes the check again', () => {
    const dir = workingCopy();
    appendLine(path.join(dir, library[0]), '// an edit with a rebuild');
    const build = runBuild(dir, []);
    if (build.status !== 0) return 'the build exited ' + build.status + ': ' + build.stderr;
    if (!fs.readFileSync(path.join(dir, OUTPUT), 'utf8').includes('// an edit with a rebuild')) {
      return 'the built file does not carry the edit';
    }
    const result = runBuild(dir, ['--check']);
    return result.status === 0 ? null : 'the check exited ' + result.status;
  });

  for (const file of [HEADER, ENTRY, library[0]]) {
    check('a missing source ' + file + ' fails the build and the check', () => {
      const dir = workingCopy();
      fs.rmSync(path.join(dir, file));
      const before = fs.readFileSync(path.join(dir, OUTPUT));
      const build = runBuild(dir, []);
      const result = runBuild(dir, ['--check']);
      if (build.status === 0) return 'the build exited 0';
      if (result.status === 0) return 'the check exited 0';
      if (!fs.readFileSync(path.join(dir, OUTPUT)).equals(before)) return 'the build wrote the Sheets file';
      return null;
    });
  }

  check('an unknown argument fails', () => {
    const result = runBuild(workingCopy(), ['--chek']);
    return result.status === 0 ? 'the build exited 0' : null;
  });
}

// The declaration read must catch what the built-file cases rely on it for,
// or a broken read would pass every built file.
function declarationReadCases() {
  const fixture = [
    'const A = 1, B = { c: 2 }, C = [3, 4];',
    'let D = /\\d{1,3}(?:,\\d{3})+/g;',
    'var E = "function NotTopLevel() {}";',
    '// const NotTopLevelEither = 1;',
    '/* function InComment() {} */',
    'const F = `text ${ { g: 1 }.g } more`;',
    'function G(x) { const H = 1; function I() {} return x / 2 / H; }',
    'class J { k() { let L = 1; return L; } }',
    'function* M() {}',
    'function G() {}',
    'const A2 = 1;',
    'const A = 3;',
  ].join('\n');
  check('the declaration read lists top-level names and skips nested, quoted, and commented ones', () => {
    const names = topLevelNames(fixture);
    const expected = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'J', 'M', 'G', 'A2', 'A'];
    return JSON.stringify(names) === JSON.stringify(expected)
      ? null : 'read ' + JSON.stringify(names);
  });
  check('the declaration read reports a repeated function and a repeated constant', () => {
    const found = repeats(topLevelNames(fixture)).sort();
    return JSON.stringify(found) === '["A","G"]' ? null : 'reported ' + JSON.stringify(found);
  });
  check('the declaration read fails on a destructuring declaration', () => {
    try {
      topLevelNames('const { a, b } = c;');
    } catch (err) {
      return null;
    }
    return 'read it without an error';
  });
  check('the identifier read skips words in comments, strings, and regular expressions', () => {
    const words = tokenize('// require\n"module" + /process/ + exports')
      .filter((t) => t.type === 'word').map((t) => t.value);
    return JSON.stringify(words) === '["exports"]' ? null : 'read ' + JSON.stringify(words);
  });
}

function builtFileCases() {
  const built = readRoot(OUTPUT);

  check('the Sheets file declares each top-level name once', () => {
    const names = topLevelNames(built);
    for (const name of ['ROUND_DYNAMIC', 'roundWithOffset', 'roundCellSetAware', 'EPSILON', 'X_FLOOR_THRESHOLD']) {
      if (!names.includes(name)) return 'the read found no top-level ' + name;
    }
    const repeated = repeats(names);
    return repeated.length === 0 ? null : 'declared more than once: ' + repeated.join(', ');
  });

  check('every line that opens a top-level declaration is one the declaration read lists', () => {
    const lines = built.match(/^(?:async\s+)?(?:function\*?|class|const|let|var)\s+[\w$]+/gm) || [];
    const names = topLevelNames(built);
    return lines.length === names.length
      ? null : lines.length + ' declaration lines, ' + names.length + ' names read';
  });

  check('the Sheets file references no require, import, export, module, or process', () => {
    const found = tokenize(built)
      .filter((t) => t.type === 'word' && FORBIDDEN_IDENTIFIERS.includes(t.value))
      .map((t) => t.value);
    return found.length === 0 ? null : 'references ' + [...new Set(found)].join(', ');
  });

  check('the Sheets file compiles as one classic script', () => {
    new vm.Script(built, { filename: OUTPUT });
    return null;
  });

  check('the Sheets file runs by eval with no Node globals and ROUND_DYNAMIC answers', () => {
    const context = vm.createContext({});
    vm.runInContext(built, context, { filename: OUTPUT });
    const single = vm.runInContext('ROUND_DYNAMIC(1234)', context);
    const dataset = vm.runInContext('JSON.stringify(ROUND_DYNAMIC([[1234, 56], ["text", ""]]))', context);
    if (typeof single !== 'number') return 'single mode returned ' + single;
    if (!dataset.startsWith('[[')) return 'dataset mode returned ' + dataset;
    return null;
  });

  check('the help card JSDoc with the [VERSION] line sits directly above ROUND_DYNAMIC', () => {
    const match = built.match(/\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*function ROUND_DYNAMIC\(/);
    if (!match) return 'no JSDoc block directly above ROUND_DYNAMIC';
    if (!/^ \* \[VERSION\] \d+(?:\.\d+)*$/m.test(match[1])) return 'the block holds no [VERSION] line';
    if (!match[1].includes('@customfunction')) return 'the block holds no @customfunction tag';
    return null;
  });

  check('the Sheets file carries the version line of the Sheets entry source', () => {
    const line = /^ \* \[VERSION\] .*$/m;
    const entry = readRoot(ENTRY).match(line);
    const output = built.match(line);
    if (!entry) return 'the Sheets entry source holds no [VERSION] line';
    if (!output || output[0] !== entry[0]) return 'the Sheets file holds ' + (output && output[0]);
    return null;
  });
}

function main() {
  process.stdout.write('build-sheets self-test\n');
  try {
    cleanCheckoutCases();
    staleCases();
    declarationReadCases();
    builtFileCases();
  } catch (err) {
    recordFail('the self-test could not run', err.message);
  } finally {
    for (const dir of scratchDirs) fs.rmSync(dir, { recursive: true, force: true });
  }
  process.stdout.write(passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}

main();
