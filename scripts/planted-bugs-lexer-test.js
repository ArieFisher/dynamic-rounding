#!/usr/bin/env node
/**
 * Self-test for scripts/planted-bugs-lexer.js, the lexer and planted bug
 * table of the planted bug script.
 *
 * The cases list the planted bugs in short snippets of code and compare
 * them with an answer worked out by hand from the changes that
 * PLANTED_BUG_CHANGES in scripts/planted-bugs-lexer.js lists. The last cases check that
 * each planted bug leaves the code parseable, in the snippets and in the
 * extension's product files. No case runs a suite.
 *
 * Run with no arguments; exits 0 when every case passes and 1 when any case
 * fails. Node standard library only.
 */

'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { plantBugs } = require('./planted-bugs-lexer.js');

const ROOT = path.join(__dirname, '..');

// Each row: a snippet, and each planted bug as its change and the snippet
// after it.
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
  ["x = '\\\\d|(?:a' + y + ')';", []],
  ["x = 'a\\\\+b\\\\?\\\\|c\\\\*(?:\\\\(d)';", []],
];

const NO_PATTERN_ROWS = [
  ["x = 'Are you sure?';", []],
  ['x = \'[role="grid"]\';', []],
  ["x = 'a+b*c? (x|y) [ab] ^$';", []],
  ['x = `a+b* ${y} c?`;', []],
  ["// /a?b+/ '\\\\d*' (?:a|b)\nx;", []],
  ['/* /^a$/ [ab] */ x;', []],
];

let passed = 0;
let failed = 0;

// Runs one case: the body returns nothing on a pass and a failure detail
// string, or throws, on a failure.
function check(name, body) {
  let detail;
  try {
    detail = body();
  } catch (err) {
    detail = 'threw: ' + err.message;
  }
  if (detail) {
    failed++;
    process.stdout.write('  FAIL  ' + name + '\n        ' + detail.split('\n').join('\n        ') + '\n');
  } else {
    passed++;
    process.stdout.write('  pass  ' + name + '\n');
  }
}

function differs(what, actual, expected) {
  const actualText = JSON.stringify(actual, null, 1);
  const expectedText = JSON.stringify(expected, null, 1);
  return actualText === expectedText ? null : `${what}\n expected ${expectedText}\n actual ${actualText}`;
}

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

function snippetTable(heading, rows) {
  process.stdout.write(`${heading}\n`);
  for (const [snippet, expected] of rows) {
    const result = expected.length ? expected.join(' | ') : 'no planted bug';
    check(`plantBugs on ${snippet.replace(/\n/g, '\\n')}: ${result}`, () =>
      differs('planted bugs', plantedIn(snippet), [...expected].sort()));
  }
}

function parseCases() {
  process.stdout.write('Each planted bug leaves the code parseable\n');
  check('plantBugs on every snippet above: each planted bug leaves the snippet parseable', () => {
    const failures = [...REGEX_LITERAL_ROWS, ...PATTERN_TEXT_ROWS, ...NO_PATTERN_ROWS]
      .flatMap(([snippet]) => parseFailures('snippet.js', snippet));
    return failures.length ? failures.join('\n') : null;
  });
  // The test pieces hold most of the extension's code, and planting bugs in
  // them takes about a minute, so the case reads the product files only.
  check('plantBugs on every product file of the extension: each planted bug leaves the file parseable', () => {
    const files = childProcess.execFileSync('git', ['-C', ROOT, 'ls-files', '-z', '--', 'chrome-extension/*.js',
      ':(exclude)chrome-extension/tests.js', ':(exclude)chrome-extension/tests/*'],
    { encoding: 'utf8' }).split('\0').filter(Boolean);
    if (!files.length) return 'no product file under chrome-extension';
    const failures = files.flatMap((file) => parseFailures(file, fs.readFileSync(path.join(ROOT, file), 'utf8')));
    return failures.length ? failures.join('\n') : null;
  });
}

function main() {
  const started = Date.now();
  snippetTable('Pattern changes inside a regular expression literal', REGEX_LITERAL_ROWS);
  snippetTable('Pattern changes inside string and template text that holds pattern syntax', PATTERN_TEXT_ROWS);
  snippetTable('No planted bug in a comment, or in string or template text without pattern syntax', NO_PATTERN_ROWS);
  parseCases();
  process.stdout.write(`${passed} passed, ${failed} failed in ${Date.now() - started} ms\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
