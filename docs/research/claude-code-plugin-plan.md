# Plan: the rounding plugin for Claude Code

Status: draft, not approved. Assessed 2026-11-18 against `main` at `d97adb7` and Claude Code 2.1.311.

## Context

The Chrome extension rewrites the text of table cells after the page draws them, keeps the originals, and restores them on a toggle. Claude Code's plugin system has the same shape for the session transcript. A drawing hook receives each reply block's markdown text before the engine draws it and returns a rewritten copy. The stored message, ctrl+o, and the transcript file hold the originals.

The deliverable is a fourth platform: a Claude Code plugin that simplifies the markdown tables in the transcript, toggled by the user, built from the shared library unchanged.

## Product choices

Decided by Arie, 2026-11-16, and the command name on 2026-11-18:

1. **What rounds.** Markdown tables only. Numbers in prose stay as written.
2. **Default.** Off at every session start. Nothing is stored across sessions.
3. **The user event.** A slash command, plus a trial of a per-row button (Step 2).
4. **Status entry.** Kept.
5. **Command name: `/simplify-data`.** Claude Code ships a `/simplify` of its own, so a plugin command of that name does not register.

Decided in this assessment, 2026-11-18. Arie may reverse it:

6. **Settings: the extension's shipped defaults.** The header row and the first column stay as written, dates simplify to the year, and both offsets are -0.5. The earlier draft held the Sheets options. Under those, a header "Revenue 2024" becomes "Revenue 2,000" and a row label "Item 12" becomes "Item 10" (run in Node).

## Checked

A trial plugin ran on 2026-11-18. The appendix holds its code.

| Claim | How checked |
| --- | --- |
| The shared library files, joined, load as one ES module inside the engine | `claude plugin test`: pass |
| The drawing hook rewrites a reply block's text, and the toggle command redraws the row on and off, on all four surfaces | `claude plugin test`: pass |
| A command named `/simplify` does not register | `claude plugin validate`: "a name Claude Code ships: $.command.register refuses it" |
| The plugin validates with warnings treated as errors | `claude plugin validate --strict`: pass |
| A marketplace file one folder above the plugin validates | `claude plugin validate`: pass |
| The step takes 83 ms on 10,000 cells (93,000 characters) | timed in Node 26 |
| A fenced table, an unclosed fence, an escaped pipe, a table with no outer pipes, and two tables in one text come out right | run in Node |
| The engine skips a hook that throws or runs past 10 seconds, and draws its own row | read in the engine's type file, not run |
| A rewrite leaves the stored message and ctrl+o unchanged | read in the engine's type file, not run |

Not checked:

- The terminal lays out a table's columns again after a rewrite. The engine test reads the hook's output, never the terminal's paint. A manual test covers it.
- Whether the engine draws a reply block while it streams.
- Whether a button in a transcript row takes a press. Step 2 covers it.
- Whether `claude plugin test` runs with no signed-in account, as in CI.

## Vocabulary

Rows for `docs/vocabulary.md`, added on the plugin's branch as one `docs:` commit. A new section, "The Claude Code plugin", after "Capture":

| Term | Meaning | Not | Example |
| --- | --- | --- | --- |
| Claude Code plugin | The package Claude Code loads to simplify the session transcript: the fourth platform. One folder in this repository holds it. Write "the plugin" after first use. | mod, terminal extension | The Claude Code plugin simplifies a markdown table the model wrote. |
| engine | Claude Code's own name for the part that loads a plugin, runs its hooks, and draws the session transcript. | harness, host, runtime | The engine calls the drawing hook before it draws a reply block. |
| surface | Where the engine draws the session transcript: the terminal, the desktop application, VS Code, or mobile. | client, frontend | The engine test mounts a reply block on each surface. |
| session transcript | The rows the engine draws for one session: prompts, reply blocks, tool rows, command output rows. Write "the transcript" after first use. | chat, conversation (when the rows are meant), history | The session transcript holds one row per reply block. |
| reply block | One block of text in the model's reply, in markdown. A reply with tool calls holds several. The engine draws one transcript row per reply block. | assistant message, message block, response | The drawing hook rewrites a reply block's text. |
| drawing hook | The plugin's function the engine calls before it draws a reply block. While the on/off value is on, it returns the block's text with its markdown tables simplified. | render hook, display hook | The drawing hook runs again when the on/off value changes. |
| markdown table | A table in a reply block's text: a header row, a separator row of dashes, and body rows, each split into cells by pipes. A table inside a fenced code block is not a markdown table. | pipe table | The markdown adapter presents each markdown table as cells. |
| text table step | The step that takes a text and the tables found in it, runs each table's cells through the classification ladder and the table step, and returns the text with every patch applied. It holds no engine code and no markdown code. | table rewriter | The text table step turns "\| 4,236,000 \|" into "\| 4,000,000 \|". |
| toggle command | The slash command `/simplify-data`. It toggles the on/off value and returns the new value as its output row. | slash command (alone), round command | The user runs the toggle command, and every markdown table on screen simplifies. |
| status entry | The line the plugin pins under the prompt while on: "simplify-data: on". | status line (the engine's whole line), indicator | The status entry shows after the toggle command turns the plugin on. |
| plugin library | The file the Sheets build writes into the plugin's folder: the shared library files and the extension's settings contract, joined, with one export line. Committed, and the build's check covers it. | plugin build, bundle | A change to a shared library file changes the plugin library on the next build. |
| plugin test prompt | The prompt in the plugin's README that makes the model write the manual test table, with the written text to expect. The plugin's counterpart of the manual test page. | — | The plugin test prompt asks for a table of five revenue figures. |

Existing rows that widen by one clause:

| Term | Added clause |
| --- | --- |
| originals | In the plugin, a reply block's text as the model wrote it. The engine keeps it, so the plugin stores nothing. |
| written text | In the plugin, the text the drawing hook last returned for a reply block. |
| adapter | The markdown adapter presents the markdown tables in a text as cells, each with its row, its column, and its position in the text. |
| dataset | In the plugin, every cell of one markdown table. |
| toggle | In the plugin, one on/off value covers every markdown table in the transcript. |
| application model | In the plugin, the engine's session state is the application model. It holds the on/off value for the session. |
| Sheets build | It also writes the plugin library. |

Block patterns: `\bmod\b`, `\bdisplay hook`, `\brender hook`, `\bassistant message`, `\bplugin build`, `\bpipe table`.

Decisions:

- **"session value" is not a term.** The on/off value is the only value the plugin holds, and the canon already has "on/off value" and "application model".
- **"markdown adapter" has no row.** The "adapter" row covers it, as it covers the native-table adapter and the grid adapter.
- **"ASCII table" gets its row** on the branch that builds its adapter.
- **"cell cap" is not reused.** The plugin has no cap of its own (see Bounds).

## Design

### Files

```
.claude-plugin/marketplace.json     repository root; lists the plugin at ./claude-code-plugin
claude-code-plugin/
  .claude-plugin/plugin.json        name "dynamic-rounding", version, description, author, types
  hooks/hooks.json                  { "modules": ["./register.js"] }
  hooks/register.js                 the hooks module
  hooks/markdown-adapter.js         the markdown adapter
  hooks/text-table.js               the text table step
  hooks/library.js                  the plugin library (generated)
  hooks/register.test.tsx           the engine test
  types/index.d.ts                  the contract for the on/off value
  tests.js                          Node suite for the markdown adapter and the text table step
  README.md                         install line, what the plugin does, the plugin test prompt
```

The hooks module is JavaScript: the repository holds no TypeScript, and the engine loads either. The engine test is `.tsx` because the engine's test runner reads only `*.test.ts` and `*.test.tsx`.

### The hooks module

Three hooks:

- **At session start**, it registers `/simplify-data`, marked to run mid-turn.
- **On the toggle command**, it toggles the on/off value, sets or clears the status entry, and returns the new value as the output row.
- **Before the engine draws a reply block**, the drawing hook reads the on/off value. Off: the engine draws the block as written. On: the block's text goes through the markdown adapter and the text table step, and the engine draws the result. Because the hook read the value while drawing, the engine redraws every reply block when the value changes.

The module holds no failure handler: the engine skips a failed hook and draws the row as written. It holds no branch for a summary block: a summary with no table returns unchanged.

The command name is written as a literal in both places. `claude plugin validate` then lists the hook as answering its own command (checked).

### The markdown adapter

Takes a text. Returns its markdown tables, each a list of cells `{ text, rowIndex, columnIndex, start }`, where `start` is the cell text's position in the text. A cell carries no kind flag, so the text table step works the same on any adapter's cells.

- A fence line (three backticks or three tildes) opens or closes a fenced code block. The adapter skips the lines inside. An unclosed fence covers the rest of the text.
- A table is a header row holding a pipe, then a separator row of dashes holding a pipe, then every following line holding a pipe.
- A cell is the text between two pipes. The outer pipes are optional, and `\|` does not split a cell.
- The header row is row 0. The separator row presents no cells.

### The text table step

`simplifyTables(text, tables, settings)`. Each table is one dataset.

1. `classifyCell` reads each cell.
2. `tablePatches` computes the table's max magnitude and each cell's patches.
3. The step adds each cell's `start` to its patches' positions, and one `applyPatches` call writes them all into the text.

The step takes tables, not adapters. The caller adds a second adapter's tables to the list.

### Settings

The plugin passes the extension's settings contract (`DR_DEFAULTS`) to the ladder and the table step whole. It holds no settings of its own.

### The plugin library

The Sheets build's second output: `LIBRARY_FILES` and `chrome-extension/constants.js`, joined under the generated-file notice, ending in one line:

```js
export { classifyCell, tablePatches, applyPatches, DR_DEFAULTS };
```

`--check` covers both outputs. A build is needed because an installed plugin is a copy of its own folder, the engine loads ES modules only, and the shared files are classic scripts the extension loads as content scripts, which cannot hold `export`.

### Bounds

The plugin holds no cap. The engine's caps bound the step:

- **Time: 10 seconds per hook run.** Past it, the engine skips the hook and draws the row as written. The step takes 83 ms on 10,000 cells.
- **Length: 100,000 characters of a rewritten text.** Past it, the engine cuts the drawn text and writes how much it left out.

The earlier draft held the extension's cell cap. That cap bounds the re-apply observer alone; the extension's first simplification has none.

The plugin has no magnitude freeze. The step computes the max magnitude from the block's text at each draw.

## Steps

### Step 0: move `applyPatches` (own `refactor/` pull request)

Move `applyPatches` from the Sheets entry source (`js/src/entry.js:148`) to `chrome-extension/lib/dr-simplify/table.js`, and rebuild the Sheets library. No behavior changes. The Sheets suite, the doc-example suite, the extension suite, and the build check prove it.

### Step 1: the plugin (one `feature/` pull request)

Tests first, per the repository's rules.

1. **Build.** `scripts/build-sheets.js` writes the plugin library as a second output. `scripts/build-sheets-test.js` gains the second output in its scratch tree and stale cases, and one case that parses the plugin library as an ES module.
2. **Plugin.** The files above, and the marketplace file.
3. **Repository wiring.**
   - `scripts/check-files.sh`: `claude-code-plugin/` and `.claude-plugin/` join the allowed folders.
   - `scripts/bump-versions.py`: one `PACKAGES` row for `claude-code-plugin/`, with `plugin.json` as its version file and no build, because the plugin library holds no version. `scripts/bump-versions-test.sh` gains its case.
   - `.github/workflows/tests.yml`: `node claude-code-plugin/tests.js`.
   - `claude plugin validate --strict` and `claude plugin test` run before the pull request opens and go under `## Tested`. They stay out of CI: CI holds no Claude Code, and the plugin API is early access (see Risks).
4. **Vocabulary.** The rows above.
5. **Documents.**
   - `README.md`: the fourth platform and its install line, `/plugin install dynamic-rounding --marketplace ArieFisher/dynamic-rounding`.
   - `docs/design.md`: a plugin column in "Platform Differences", a sentence in "Reuse across platforms", and the three sentences that count three platforms.
   - `docs/vocabulary.md`: "all three platforms" in the number shape test row.
   - `AGENTS.md`: the plugin's suites under Testing, its path under "How versions move", `claude-code-plugin/README.md` in the living documents list, and the plugin test prompt in "The manual test page".
   - `MAINTAINERS.md`: the plugin's release steps.

### Step 2: the per-row button trial (own `feature/` branch)

Question: does a button the drawing hook draws inside a reply block take a press on the terminal, and in which rendering (fullscreen, main screen)?

- While on, the drawing hook returns its own tree for a reply block that holds a markdown table: the simplified text and one button, "original" or "simplified".
- On a press, the plugin toggles a per-row on/off value. Rows with none follow the session's on/off value.
- Bound: 200 per-row values; past that, the plugin drops the oldest. The engine's own example keeps 200.
- Outcome A, the plugin receives the press in the terminal's main-screen rendering: ship the button as the table pillbox's counterpart, with its vocabulary row.
- Outcome B, it receives the press only in fullscreen rendering or not at all: record the result in the pull request, delete the branch, keep the toggle command alone.

Steps 0 and 1 do not depend on it.

## Simplicity

1. **Size.** The code grows. Additions, with trial sizes: the hooks module (31 lines) is the display rewrite and the toggle; the markdown adapter (47 lines) is the only new parsing; the text table step (11 lines) joins cells to patches; the contract (5 lines) is what the engine requires for a value in its session state; the build's second output is what lets an ES module import classic scripts. Step 0 is one moved function: net zero.
2. **Duplicates.** `applyPatches` would exist twice; it moves first, in Step 0. The extension's patch writer also applies patches, across text pieces and with a position check; the two input shapes differ, so it stays. Settings are not duplicated: the plugin reads the settings contract.
3. **Removals.** Cut from the earlier draft: the cell cap, the failure handler, the summary branch, the adapter list parameter, the move of the Sheets ladder options, a settings object of the plugin's own, the shared case table run, and four vocabulary rows. The shared case table run is cut because the build check proves the plugin library equals the shared files, and the extension suite runs the case table on those files. The status entry stays by Arie's decision.
4. **Orphans.** The plugin library carries the detection settings and shared functions the plugin never calls, as the Sheets library carries range parsing it never calls. Accepted: the alternative is a second file list.
5. **Bounds.** See Bounds. The Step 2 trial holds at most 200 per-row values.
6. **Current behavior.** See Checked. The earlier draft held `decisionToLegacyInfo`, which #718 removed; entries now carry `decision` and `columnIndex`, and `tablePatches` computes the max magnitude itself.

## Verification

Automatic:

- Step 0: `node scripts/build-sheets.js --check`, `node js/tests.js`, `node js/doc-tests.js`, `node chrome-extension/tests.js` pass unchanged.
- Step 1: the build check and `node scripts/build-sheets-test.js`.
- Step 1: `node claude-code-plugin/tests.js`. Cases: values across two orders of magnitude; the header row and the first column stay as written; a unit number; a bracketed number; a date; a table in a fenced code block and one under an unclosed fence stay as written; an escaped pipe; no outer pipes; two tables are two datasets; a text with no table returns unchanged.
- Step 1: `claude plugin validate --strict claude-code-plugin` and `claude plugin test claude-code-plugin`. The engine test mounts a reply block holding a table on each surface, runs the toggle command twice, and checks the written text, then the originals.

Manual, in a terminal session started with `claude --plugin-dir claude-code-plugin`:

- [ ] Run the plugin test prompt, then `/simplify-data`. The table's numbers round in place, its columns stay aligned, and the status entry shows.
- [ ] Press ctrl+o. The originals show.
- [ ] Run `/simplify-data` again. The table shows as written and the status entry is gone.

A failure shows as columns that no longer align, or a dim line reporting a skipped hook.

## Risks

- **Early access.** The engine's type file states that the plugin API "may change between releases without notice". A Claude Code release can break the plugin with no change in this repository, and CI does not detect it.
- **Numbers that identify things.** Tables in a coding session hold line numbers, issue numbers, and ports. The identifier shapes list holds none of them, so they round: "entry.js:148" becomes "entry.js:150", "#718" becomes "#700", "8080" becomes "8,000" (run in Node). The plugin is off by default, and the user restores them with the toggle command. New identifier shapes would fix it on every platform; not planned here.
- **Streaming.** If the engine draws a reply block while it streams (not checked), the rows above a later, larger row round again until the block ends.

## Roadmap

In dependency order. Each adds code at a seam the design holds.

1. **ASCII adapter**: tables drawn character for character inside fenced code blocks, with box-drawing or plus-and-dash borders. The terminal does not lay them out again, so a written value must fit its cell: a width rule in the text table step, on one optional cell field the adapter sets.
2. **Tool result rows**: a second drawing hook site feeding the same adapters and step.
3. **Whitespace-aligned columns**, once a column-boundary rule exists.
4. **Per-row button**, if Step 2 ends in outcome A.
5. **Lens through `/config`**, if one fixed lens proves too coarse.

## User events considered

Read in the engine's type file. No global key-press event exists.

- **Slash command**: chosen.
- **Button in the reply block**: Step 2.
- **Button in a band above the prompt, or in a pane**: needs focus or a pointer; no custom key.
- **Row in `/config`**: a change reloads the plugin; fit for the lens, not a toggle.
- **Typed phrase**: reads like an ordinary prompt.
- **Hover**: shows a value; not a toggle.

## Appendix: trial code

Checked as listed under Checked. `applyPatches` came from a copy, standing in for Step 0.

`hooks/register.js`:

```js
import { atom, read, update } from 'claude-code';

import { DR_DEFAULTS } from './library.js';
import { markdownTables } from './markdown-adapter.js';
import { simplifyTables } from './text-table.js';

const STATUS_ENTRY = 'simplify-data: on';
const isOn = atom({ plugin: 'dynamic-rounding', key: 'isOn' }, false);

export const register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'simplify-data',
      description: 'Simplify the numbers in markdown tables, on or off',
      immediate: true,
    });
    return next(e);
  });

  on('command.run', { command: 'simplify-data' }, async ($) => {
    const isNowOn = await update($, isOn, (value) => !value);
    $.ui.status(isNowOn ? STATUS_ENTRY : undefined);
    return { text: isNowOn ? STATUS_ENTRY : 'simplify-data: off' };
  });

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e);
    const text = simplifyTables(e.props.text, markdownTables(e.props.text), DR_DEFAULTS);
    return next({ ...e, props: { ...e.props, text } });
  });
};
```

`hooks/text-table.js`:

```js
import { classifyCell, tablePatches, applyPatches } from './library.js';

export function simplifyTables(text, tables, settings) {
  const patches = tables.flatMap((cells) => {
    const entries = cells.map((cell) =>
      ({ ...cell, decision: classifyCell({ ...cell, ranges: null }, settings) }));
    return tablePatches(entries, settings).cells.flatMap(({ entry, patches: cellPatches }) =>
      cellPatches.map((patch) => ({ ...patch, index: patch.index + entry.start })));
  });
  return applyPatches(text, patches);
}
```

`hooks/markdown-adapter.js`:

```js
const FENCE = /^\s*(```|~~~)/;
const SEPARATOR_ROW = /^(?=.*\|)\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function linesWithStart(text) {
  let start = 0;
  return text.split('\n').map((line) => {
    const entry = { line, start };
    start += line.length + 1;
    return entry;
  });
}

function rowCells({ line, start }, rowIndex) {
  const pieces = [];
  let pieceStart = 0;
  for (let i = 0; i <= line.length; i++) {
    if (line[i] === '\\') {
      i++;
    } else if (i === line.length || line[i] === '|') {
      pieces.push({ text: line.slice(pieceStart, i), start: start + pieceStart });
      pieceStart = i + 1;
    }
  }
  const isOutside = (piece) => piece.text.trim() === '';
  return pieces
    .slice(isOutside(pieces[0]) ? 1 : 0, isOutside(pieces.at(-1)) ? -1 : undefined)
    .map((piece, columnIndex) => ({ ...piece, rowIndex, columnIndex }));
}

export function markdownTables(text) {
  const lines = linesWithStart(text);
  const isRow = (entry) => entry !== undefined && entry.line.includes('|') && !FENCE.test(entry.line);
  const tables = [];
  let isInFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i].line)) isInFence = !isInFence;
    const isHeaderRow = !isInFence && isRow(lines[i])
      && lines[i + 1] !== undefined && SEPARATOR_ROW.test(lines[i + 1].line);
    if (!isHeaderRow) continue;

    const rows = [lines[i]];
    for (let j = i + 2; isRow(lines[j]); j++) rows.push(lines[j]);
    tables.push(rows.flatMap(rowCells));
    i += rows.length;
  }
  return tables;
}
```

`types/index.d.ts`:

```ts
declare module 'claude-code' {
  interface PluginState {
    'dynamic-rounding': { isOn: boolean }
  }
}
```
