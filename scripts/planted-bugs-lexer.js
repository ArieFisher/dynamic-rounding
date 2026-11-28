/**
 * The lexer and the planted bug table of scripts/planted-bugs.js: reads a
 * product file and lists the planted bugs the table makes in it.
 * docs/sprint-plans/test-dedup.md, section 3.2 and the Decisions Log entry on
 * patterns, holds the design.
 * Node standard library only.
 */

'use strict';

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
// run past the line end is division, and the lexer gets null.
function skipRegex(text, index) {
  let i = index + 1;
  let inClass = false;
  while (i < text.length && text[i] !== '\n') {
    if (text[i] === '\\') { i += 2; continue; }
    if (text[i] === '[') inClass = true;
    else if (text[i] === ']') inClass = false;
    else if (text[i] === '/' && !inClass) return { bodyEnd: i, flags: matchAt(/[a-z]*/y, text, i + 1) };
    i++;
  }
  return null;
}

function regexAllowedAfter(token) {
  if (!token) return true;
  if (token.type === 'name') return KEYWORDS_BEFORE_REGEX.has(token.text);
  if (token.type === 'punct') return ![')', ']', '}'].includes(token.text);
  return false;
}

// Comments yield no token, so no planted bug lands in them. Each regular
// expression, string, and piece of template text yields one 'literal' token
// holding the range of its text, which only the pattern changes edit, and the
// lexer treats a slash after it as division.
function lexCode(text) {
  const tokens = [];
  const templateBraces = [];
  let i = 0;
  const push = (type, tokenText, start) => tokens.push({ type, text: tokenText, start });
  const pushLiteral = (kind, start, textStart, textEnd, flags = '') =>
    tokens.push({ type: 'literal', text: '', start, kind, textStart, textEnd, flags });
  const resumeTemplate = (from) => {
    const { end, opensExpression } = skipTemplateText(text, from);
    pushLiteral('template', from, from, end - (opensExpression ? 2 : 1));
    if (opensExpression) { templateBraces.push(0); push('punct', '${', end - 2); }
    return end;
  };
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (text.startsWith('//', i)) { const end = text.indexOf('\n', i); i = end < 0 ? text.length : end; continue; }
    if (text.startsWith('/*', i)) { const end = text.indexOf('*/', i + 2); i = end < 0 ? text.length : end + 2; continue; }
    if (ch === '"' || ch === "'") {
      const end = skipQuoted(text, i);
      pushLiteral('string', i, i + 1, end - 1);
      i = end;
      continue;
    }
    if (ch === '`') { i = resumeTemplate(i + 1); continue; }
    if (ch === '/' && regexAllowedAfter(tokens[tokens.length - 1])) {
      const regex = skipRegex(text, i);
      if (regex) { pushLiteral('regex', i, i + 1, regex.bodyEnd, regex.flags); i = regex.bodyEnd + 1 + regex.flags.length; continue; }
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

// String and template text holds a pattern when it holds a doubled
// backslash, which stands for a backslash escape in the pattern, or "(?",
// which opens group syntax. A pattern change lands in no other string text.
const PATTERN_SYNTAX = /\\\\|\(\?/;

function holdsPattern(token, text) {
  return token.type === 'literal' &&
    (token.kind === 'regex' || PATTERN_SYNTAX.test(text.slice(token.textStart, token.textEnd)));
}

// One unit per pattern character or escape, with its range in the file; an
// escape has no ch. In string and template text, a pattern escape is a
// doubled backslash and the escaped character, itself written with a
// backslash when it is a backslash or a quote, and a single backslash starts
// a string escape, which stands for a plain character.
function patternUnits(text, token) {
  const escape = token.kind === 'regex' ? '\\' : '\\\\';
  const units = [];
  let inClass = false;
  for (let i = token.textStart; i < token.textEnd;) {
    let end = i + 1;
    if (text.startsWith(escape, i)) end = i + escape.length + (escape.length === 2 && text[i + 2] === '\\' ? 2 : 1);
    else if (text[i] === '\\') end = i + 2;
    const ch = end === i + 1 ? text[i] : '';
    const isClassEnd = inClass && ch === ']';
    units.push({ start: i, end: Math.min(end, token.textEnd), ch, inClass: inClass && !isClassEnd });
    if (isClassEnd) inClass = false;
    else if (ch === '[') inClass = true;
    i = end;
  }
  return units;
}

// A planted bug that leaves a regular expression literal invalid would stop
// its file from loading. String text gets no such check, because its escapes
// differ from the pattern's; there an invalid pattern counts as invalid.
function leavesValidRegex(text, token, { start, end, after }) {
  try {
    new RegExp(text.slice(token.textStart, start) + after + text.slice(end, token.textEnd), token.flags);
    return true;
  } catch {
    return false;
  }
}

function patternChange(change, findEdits) {
  return {
    change,
    plant: (tokens, i, text) => {
      const token = tokens[i];
      if (!holdsPattern(token, text)) return [];
      const edits = findEdits(patternUnits(text, token), token);
      return token.kind === 'regex' ? edits.filter((one) => leavesValidRegex(text, token, one)) : edits;
    },
  };
}

function eachUnit(change, test, after) {
  return patternChange(change, (units) => units
    .filter((unit, k) => !unit.inClass && test(unit, units[k - 1] || {}))
    .map((unit) => edit(unit.start, unit.end, after)));
}

// The text after "(" and any group syntax: "?:", "?=", "?!", "?<=", "?<!",
// or "?<name>".
function groupBodyStart(units, k) {
  const at = (n) => (units[k + n] || {}).ch;
  if (at(1) !== '?') return units[k].end;
  if ([':', '=', '!'].includes(at(2))) return units[k + 2].end;
  if (at(2) !== '<') return units[k].end;
  if (['=', '!'].includes(at(3))) return units[k + 3].end;
  const nameEnd = units.findIndex((unit, n) => n > k && unit.ch === '>');
  return nameEnd < 0 ? units[k].end : units[nameEnd].end;
}

// Each alternative of a "|" list goes with the "|" before it, and the first
// with the "|" after it. In string and template text, text before the first
// "|" outside any group may continue a pattern begun in other text, so it
// stays, and so does a last alternative that holds a group the text leaves
// open, because removing it would leave the parentheses unbalanced.
function alternativeEdits(units, token) {
  const edits = [];
  const close = (frame, end) => {
    const ends = [...frame.bars.slice(1), end];
    frame.bars.forEach((bar, n) => { if (ends[n] !== null) edits.push(edit(bar, ends[n], '')); });
    if (frame.bars.length && frame.isOpenedHere) edits.push(edit(frame.from, frame.bars[0] + 1, ''));
  };
  const frames = [{ from: token.textStart, bars: [], isOpenedHere: token.kind === 'regex' }];
  units.forEach((unit, k) => {
    if (unit.inClass) return;
    if (unit.ch === '(') frames.push({ from: groupBodyStart(units, k), bars: [], isOpenedHere: true });
    if (unit.ch === '|') frames[frames.length - 1].bars.push(unit.start);
    if (unit.ch !== ')') return;
    close(frames.pop(), unit.start);
    if (!frames.length) frames.push({ from: unit.end, bars: [], isOpenedHere: false });
  });
  frames.forEach((frame, n) => close(frame, n === frames.length - 1 ? token.textEnd : null));
  return edits;
}

function classFirstEdits(units) {
  return units.flatMap((unit, k) => {
    if (unit.inClass || unit.ch !== '[') return [];
    const first = (units[k + 1] || {}).ch === '^' ? k + 2 : k + 1;
    const members = units.slice(first).findIndex((member) => !member.inClass);
    const count = members < 0 ? units.length - first : members;
    return count >= 2 ? [edit(units[first].start, units[first].end, '')] : [];
  });
}

// A "?" after "(" opens group syntax, and one after a quantifier makes that
// quantifier lazy.
const NOT_BEFORE_OPTIONAL = ['(', '*', '+', '?', '}'];

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
  eachUnit('? quantifier removed', (unit, before) => unit.ch === '?' && !NOT_BEFORE_OPTIONAL.includes(before.ch), ''),
  eachUnit('* to +', (unit) => unit.ch === '*', '+'),
  eachUnit('+ quantifier removed', (unit) => unit.ch === '+', ''),
  eachUnit('anchor removed', (unit) => unit.ch === '^' || unit.ch === '$', ''),
  patternChange('alternative removed', alternativeEdits),
  patternChange('first class member removed', classFirstEdits),
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
      for (const { start, end, after } of plant(tokens, i, text)) {
        const before = text.slice(start, end);
        if (before !== after) bugs.push({ file, ...lineAndColumn(text, start), start, before, after, change });
      }
    }
  });
  return bugs;
}

module.exports = { plantBugs };
