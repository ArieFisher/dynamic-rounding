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
  'helpers.js',
  'number-tests.js',
  'ladder-tests.js',
  'pillbox-tests.js',
  'detection-tests.js',
  'rounding-pass-tests.js',
  'table-kinds-tests.js',
  'table-step-tests.js',
  'sidebar-tests.js',
  'controller-tests.js',
  'bus-tests.js',
  'table-registration-tests.js',
  'capture-log-tests.js',
  'source-checks-tests.js',
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
const JOINED_FRAME = new RegExp(
  `${JOINED_FILENAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(\\d+)(:\\d+)?`, 'g');

function pieceAt(joinedLine, startLines) {
  let index = startLines.length - 1;
  while (index > 0 && startLines[index] > joinedLine) index--;
  return { piece: PIECES[index], line: joinedLine - startLines[index] + 1 };
}

function mapToPieces(stack, startLines) {
  return String(stack).replace(JOINED_FRAME, (frame, line, column) => {
    const { piece, line: pieceLine } = pieceAt(Number(line), startLines);
    return `${path.join(PIECES_DIR, piece)}:${pieceLine}${column || ''}`;
  });
}

// scripts/planted-bugs.js sets TEST_RECORD_PATH. With it set, the runner
// writes one entry per assertion to that file at process exit, so an
// assertion that runs after a timer is in the record. A piece is a path from
// the repository root. `pieces` holds every piece on the assertion's stack,
// so an assertion a helper makes counts against the piece that called it.
function assertionRecorder(recordPath, startLines) {
  if (!recordPath) return () => {};
  const repositoryRoot = path.join(__dirname, '..');
  const piecePath = (piece) =>
    path.relative(repositoryRoot, path.join(PIECES_DIR, piece)).split(path.sep).join('/');
  const entries = [];
  process.on('exit', () => fs.writeFileSync(recordPath, JSON.stringify(entries)));
  return (name, passed) => {
    const savedLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = Infinity;
    const stack = new Error().stack;
    Error.stackTraceLimit = savedLimit;
    // The first frame of the joined suite is eq itself; the next is its call site.
    const frames = [...stack.matchAll(JOINED_FRAME)].slice(1)
      .map((match) => pieceAt(Number(match[1]), startLines));
    entries.push({
      piece: piecePath(frames[0].piece),
      line: frames[0].line,
      name,
      passed,
      pieces: [...new Set(frames.map((frame) => piecePath(frame.piece)))],
    });
  };
}

checkPieces();
const { source, startLines } = joinPieces();
process.on('uncaughtException', (error) => {
  console.error(mapToPieces(error && error.stack ? error.stack : error, startLines));
  process.exit(1);
});
const runSuite = vm.compileFunction(source, ['require', '__dirname', 'SUITE_SOURCE', 'recordAssertion'],
  { filename: JOINED_FILENAME });
runSuite.call(module.exports, require, __dirname, source,
  assertionRecorder(process.env.TEST_RECORD_PATH, startLines));
