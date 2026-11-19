// The Node suite for the two parts of the Claude Code plugin that hold no
// engine code: the markdown adapter and the text table step.
// Run: node claude-code-plugin/tests.js

import fs from 'node:fs';

import { DR_DEFAULTS } from './hooks/library.js';
import { markdownTables } from './hooks/markdown-adapter.js';
import { simplifyTables } from './hooks/text-table.js';

let passed = 0;
const failures = [];

function eq(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    return;
  }
  failures.push({ name, actual, expected });
}

const lines = (...rows) => rows.join('\n');
const simplify = (text, settings = DR_DEFAULTS) =>
  simplifyTables(text, markdownTables(text), settings);

// --- The markdown adapter. ---

(function adapter_presentsEachCellWithItsPosition() {
  const text = lines(
    'Revenue by item:',
    '',
    '| Item | Revenue |',
    '| --- | ---: |',
    '| Item 12 | 4,236,000 |',
    '| Item 7 | 8,120 |',
    '',
    'Both rows are estimates.',
  );
  const tables = markdownTables(text);
  eq('adapter: a text with one markdown table presents one table', tables.length, 1);
  const cells = tables[0];
  eq('adapter: the header row is row 0, and the separator row presents no cells',
    cells.map((cell) => [cell.rowIndex, cell.columnIndex, cell.text.trim()]),
    [[0, 0, 'Item'], [0, 1, 'Revenue'], [1, 0, 'Item 12'], [1, 1, '4,236,000'], [2, 0, 'Item 7'], [2, 1, '8,120']]);
  eq('adapter: each cell\'s start is the position of its text in the whole text',
    cells.every((cell) => text.slice(cell.start, cell.start + cell.text.length) === cell.text), true);
  eq('adapter: a cell carries its text, row, column, and start, and nothing else',
    Object.keys(cells[0]).sort(), ['columnIndex', 'rowIndex', 'start', 'text']);
})();

(function adapter_tableEndsAtTheFirstLineWithNoPipe() {
  const text = lines(
    '| Item | Revenue |',
    '| --- | --- |',
    '| Item 12 | 4,236,000 |',
    'A line of prose holding 983,321.',
    '| Item 7 | 8,120 |',
  );
  eq('adapter: a table ends at the first line holding no pipe',
    markdownTables(text).map((cells) => cells.length), [4]);
})();

(function adapter_needsASeparatorRow() {
  eq('adapter: a line holding a pipe with no separator row under it is not a table',
    markdownTables('Write a | b for either one. The total is 4,236,000.'), []);
  eq('adapter: a text with no pipe presents no table',
    markdownTables('The total is 4,236,000.'), []);
  eq('adapter: an empty text presents no table', markdownTables(''), []);
})();

(function adapter_readsOptionalOuterPipes() {
  const text = lines(
    'Item | Revenue',
    '--- | ---',
    'Item 12 | 4,236,000',
  );
  eq('adapter: a table with no outer pipes presents the same cells',
    markdownTables(text)[0].map((cell) => [cell.rowIndex, cell.columnIndex, cell.text.trim()]),
    [[0, 0, 'Item'], [0, 1, 'Revenue'], [1, 0, 'Item 12'], [1, 1, '4,236,000']]);
})();

(function adapter_escapedPipeDoesNotSplitACell() {
  const text = lines(
    '| Item | Revenue |',
    '| --- | --- |',
    '| A \\| B | 4,236,000 |',
  );
  eq('adapter: an escaped pipe stays inside its cell',
    markdownTables(text)[0].filter((cell) => cell.rowIndex === 1).map((cell) => cell.text),
    [' A \\| B ', ' 4,236,000 ']);
})();

(function adapter_rowEndingInABackslashKeepsItsLastCell() {
  const text = lines(
    'Item | Revenue',
    '--- | ---',
    'Item 12 | 4,236,000\\',
  );
  eq('adapter: a row ending in a backslash keeps its last cell',
    markdownTables(text)[0].filter((cell) => cell.rowIndex === 1).map((cell) => cell.text),
    ['Item 12 ', ' 4,236,000\\']);
})();

(function adapter_skipsFencedCodeBlocks() {
  const table = ['| Item | Revenue |', '| --- | --- |', '| Item 12 | 4,236,000 |'];
  eq('adapter: a table inside a backtick fence is not a markdown table',
    markdownTables(lines('```', ...table, '```')), []);
  eq('adapter: a table inside a tilde fence is not a markdown table',
    markdownTables(lines('~~~text', ...table, '~~~')), []);
  eq('adapter: an unclosed fence covers the rest of the text',
    markdownTables(lines('Before.', '```', ...table)), []);
  eq('adapter: a table after a closed fence is a markdown table',
    markdownTables(lines('```', ...table, '```', '', ...table)).length, 1);
  eq('adapter: a fence line right under a table ends the table and opens the fenced code block',
    markdownTables(lines(...table, '```', ...table, '```')).map((cells) => cells.length), [4]);
})();

(function adapter_presentsEachTableOnItsOwn() {
  const table = ['| Item | Revenue |', '| --- | --- |', '| Item 12 | 4,236,000 |'];
  eq('adapter: two tables in one text are two lists of cells',
    markdownTables(lines(...table, '', 'Then:', '', ...table)).map((cells) => cells.length), [4, 4]);
})();

// --- The text table step, under the extension's settings contract. ---

(function step_roundsEachValueAndKeepsTheHeaderRowAndFirstColumn() {
  const written = simplify(lines(
    '| Item | Revenue 2024 | Units |',
    '| --- | ---: | ---: |',
    '| Item 12 | 4,236,000 | 8,120 |',
    '| Item 7 | 983,321 | 412 |',
  )).split('\n');
  eq('text table step: the header row stays as written', written[0], '| Item | Revenue 2024 | Units |');
  eq('text table step: the separator row stays as written', written[1], '| --- | ---: | ---: |');
  eq('text table step: values in several orders of magnitude round, and the first column stays as written',
    written.slice(2), ['| Item 12 | 4,000,000 | 8,000 |', '| Item 7 | 1,000,000 | 400 |']);
})();

(function step_roundsEachKindOfCell() {
  const written = simplify(lines(
    '| Item | Value |',
    '| --- | --- |',
    '| Assets | 4.91tn |',
    '| Loss | (1,234) |',
    '| Start | 2096-12-13 |',
    '| Note | pending |',
  )).split('\n').slice(2);
  eq('text table step: a unit number rounds its digits and keeps its suffix', written[0], '| Assets | 5tn |');
  eq('text table step: a bracketed number rounds its digits and keeps its brackets', written[1], '| Loss | (1,000) |');
  eq('text table step: a date simplifies to the year', written[2], '| Start | 2096 |');
  eq('text table step: a cell with no number stays as written', written[3], '| Note | pending |');
})();

(function step_leavesFencedTablesAsWritten() {
  const table = ['| Item | Revenue |', '| --- | --- |', '| Item 12 | 4,236,000 |'];
  const fenced = lines('```', ...table, '```');
  eq('text table step: a table in a fenced code block stays as written', simplify(fenced), fenced);
  const unclosed = lines('Before.', '~~~', ...table);
  eq('text table step: a table under an unclosed fence stays as written', simplify(unclosed), unclosed);
})();

(function step_escapedPipeKeepsTheFirstColumnWhole() {
  eq('text table step: a number after an escaped pipe in the first column stays as written',
    simplify(lines(
      '| Item | Revenue |',
      '| --- | --- |',
      '| A \\| 1,234 | 5,678 |',
    )).split('\n')[2],
    '| A \\| 1,234 | 5,500 |');
})();

(function step_roundsATableWithNoOuterPipes() {
  eq('text table step: a table with no outer pipes rounds',
    simplify(lines('Item | Revenue', '--- | ---', 'Item 12 | 4,236,000')),
    lines('Item | Revenue', '--- | ---', 'Item 12 | 4,000,000'));
})();

(function step_twoTablesAreTwoDatasets() {
  // The offsets differ, so a value's band shows in its result: 8,120 rounds
  // to 8,100 in the other band and to 8,000 in the top band.
  const settings = { ...DR_DEFAULTS, offsetOther: -1 };
  const written = simplify(lines(
    '| Item | Revenue |',
    '| --- | --- |',
    '| Item 12 | 4,236,000 |',
    '| Item 7 | 8,120 |',
    '',
    '| Item | Revenue |',
    '| --- | --- |',
    '| Item 7 | 8,120 |',
  ), settings).split('\n');
  eq('text table step: beside 4,236,000, the value 8,120 rounds in the other band', written[3], '| Item 7 | 8,100 |');
  eq('text table step: alone in a second table, 8,120 rounds in the top band', written[7], '| Item 7 | 8,000 |');
})();

(function step_returnsATextWithNoTableUnchanged() {
  const prose = 'Revenue was 4,236,000 in 2024, up from 983,321.';
  eq('text table step: a text with no table returns unchanged', simplify(prose), prose);
  eq('text table step: an empty text returns unchanged', simplify(''), '');
})();

(function step_leavesTheTextAroundATableAsWritten() {
  eq('text table step: numbers in the prose around a table stay as written',
    simplify(lines(
      'Revenue was 4,236,000 in 2024.',
      '',
      '| Item | Revenue |',
      '| --- | --- |',
      '| Item 12 | 4,236,000 |',
      '',
      'The 983,321 figure is an estimate.',
    )),
    lines(
      'Revenue was 4,236,000 in 2024.',
      '',
      '| Item | Revenue |',
      '| --- | --- |',
      '| Item 12 | 4,000,000 |',
      '',
      'The 983,321 figure is an estimate.',
    ));
})();

// --- The plugin test prompt in the README. ---

// The README states the table to send and the written text to expect. This
// case runs the first through the step and compares, so the README cannot
// state a result the plugin does not write. A README with no such section,
// or with another count of text blocks in it, fails the case.
(function readme_pluginTestPromptStatesWhatTheStepWrites() {
  const readme = fs.readFileSync(new URL('./README.md', import.meta.url), 'utf8');
  const section = readme.split(/^## /m).find((part) => part.startsWith('Plugin test prompt')) || '';
  const blocks = [...section.matchAll(/^```text\n([\s\S]*?)^```$/gm)].map((match) => match[1]);
  eq('README: the plugin test prompt section holds two text blocks, the prompt and the written text',
    blocks.length, 2);
  if (blocks.length !== 2) return;
  const [prompt, written] = blocks;
  const table = prompt.slice(prompt.indexOf('|'));
  eq('README: the prompt holds one markdown table', markdownTables(table).length, 1);
  eq('README: the written text to expect is what the text table step writes for the prompt\'s table',
    simplify(table), written);
})();

process.stdout.write('Passed: ' + passed + '\nFailed: ' + failures.length + '\n');
for (const { name, actual, expected } of failures) {
  process.stdout.write('\n  ' + name + '\n    expected: ' + JSON.stringify(expected)
    + '\n    actual:   ' + JSON.stringify(actual) + '\n');
}
process.exit(failures.length === 0 ? 0 : 1);
