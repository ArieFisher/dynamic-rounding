/**
 * Test runner for the Chrome extension.
 * Run: node tests.js
 *
 * The suite lives in pieces under tests/. This runner joins the pieces in
 * PIECES order and runs the joined suite as one script, so every piece shares
 * one scope: a function one piece defines is callable from every piece, and
 * state one piece leaves behind reaches the pieces after it. The joined suite
 * receives its own text as SUITE_SOURCE, for the checks that scan the suite.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PIECES_DIR = path.join(__dirname, 'tests');

// The one list of pieces, in run order. The first piece holds the shared
// setup and the helpers every piece reads; the last prints the report.
const PIECES = [
  'setup.js',
  'part-01.js', 'part-02.js', 'part-03.js', 'part-04.js',
  'part-05.js', 'part-06.js', 'part-07.js', 'part-08.js',
  'part-09.js', 'part-10.js', 'part-11.js', 'part-12.js',
  'part-13.js', 'part-14.js', 'part-15.js', 'part-16.js',
  'report.js',
];

// Stack frames in the joined suite carry this name, which no file on disk
// holds; mapToPieces rewrites each frame to its piece and line.
const JOINED_FILENAME = path.join(PIECES_DIR, 'joined-suite.js');

function exitWithError(message) {
  console.error(`tests.js: ${message}`);
  process.exit(1);
}

// A piece on disk outside the list would never run, and a listed piece
// missing from disk would run nothing, so both stop the run.
function checkPieces() {
  if (PIECES.length === 0) exitWithError('the order list is empty');
  if (new Set(PIECES).size !== PIECES.length) exitWithError('the order list names a piece twice');
  const onDisk = fs.readdirSync(PIECES_DIR).filter((name) => name.endsWith('.js'));
  const unlisted = onDisk.filter((name) => !PIECES.includes(name));
  if (unlisted.length > 0) exitWithError(`pieces missing from the order list: ${unlisted.join(', ')}`);
  const absent = PIECES.filter((name) => !onDisk.includes(name));
  if (absent.length > 0) exitWithError(`listed pieces missing from ${PIECES_DIR}: ${absent.join(', ')}`);
}

// Each piece ends in a newline, so no piece's last line runs into the next
// piece's first. startLines[i] is the joined-suite line where piece i begins.
function joinPieces() {
  const texts = PIECES.map((name) => {
    const text = fs.readFileSync(path.join(PIECES_DIR, name), 'utf8');
    return text.endsWith('\n') ? text : text + '\n';
  });
  const startLines = [];
  let line = 1;
  for (const text of texts) {
    startLines.push(line);
    line += text.split('\n').length - 1;
  }
  return { source: texts.join(''), startLines };
}

// A stack frame carries line and column; a syntax error's location carries
// the line alone.
function mapToPieces(stack, startLines) {
  const escaped = JOINED_FILENAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(stack).replace(new RegExp(`${escaped}:(\\d+)(:\\d+)?`, 'g'), (frame, line, column) => {
    let index = startLines.length - 1;
    while (index > 0 && startLines[index] > Number(line)) index--;
    const pieceLine = Number(line) - startLines[index] + 1;
    return `${path.join(PIECES_DIR, PIECES[index])}:${pieceLine}${column || ''}`;
  });
}

checkPieces();
const { source, startLines } = joinPieces();
process.on('uncaughtException', (error) => {
  console.error(mapToPieces(error && error.stack ? error.stack : error, startLines));
  process.exit(1);
});
const runSuite = vm.compileFunction(source, ['require', '__dirname', 'SUITE_SOURCE'],
  { filename: JOINED_FILENAME });
runSuite.call(module.exports, require, __dirname, source);
