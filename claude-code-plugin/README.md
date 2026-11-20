# DynamicRounding for Claude Code

The Claude Code plugin simplifies the numbers in the markdown tables of a session. It changes what the transcript shows and leaves the model's reply as written.

## Install

In a terminal:

```
claude plugin install dynamic-rounding --marketplace ArieFisher/dynamic-rounding
```

## Use

Run `/simplify-data`, the toggle command. Every markdown table in the transcript shows simplified numbers, and the status entry "simplify-data: on" shows. Run the command again, and every table shows as the model wrote it.

- The plugin is off at the start of every session.
- The engine keeps each reply block as the model wrote it. Turn the plugin off to see the originals.
- Numbers in prose stay as written. A table inside a fenced code block stays as written too.

## What simplifies

The plugin reads each cell of a markdown table the way the Chrome extension reads a table cell, under the extension's default settings. It has no settings of its own.

- The header row and the first column stay as written.
- A number rounds to the nearest half of its own order of magnitude.
- A currency amount, a percentage, a bracketed number, and a unit number round their digits and keep their marks.
- A date simplifies to its year. A time stays as written.
- An identifier shape, such as a phone number, an IP address, or a web address, stays as written.
- A number inside a link or an image, its target included, or inside inline code stays as written, and the cell's other numbers round.

The table in the plugin test prompt below holds a currency amount, a bracketed number, a percentage, a unit number, a date, a link, and inline code.

## Known limits

- A number that identifies a thing rounds when it has no identifier shape: a line number, an issue number, a port. The transcript shows "entry.js:148" as "entry.js:150", "#718" as "#700", and "8080" as "8,000".
- A path written outside a link and outside inline code rounds its numbers: the transcript shows docs/sprint-12/plan.md as docs/sprint-10/plan.md.

Turn the plugin off to read such a table as written.

## Plugin test prompt

The plugin draws no page, so its manual test runs on a table the model writes. From the repository root, start a terminal session with `claude --plugin-dir claude-code-plugin`, and send this prompt:

```text
Write this markdown table exactly as it is, with no other text:

| Region | Revenue 2024 | Change | Share | Costs | Updated | Notes |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| North 12 | $4,236,000 | 412,300 | 41.3% | 3.31m | 2024-03-15 | [report 4,236,000](reports/north-12.md) |
| South 7 | $983,321 | (18,250) | 9.6% | 0.82m | 2024-03-18 | `983,321` |
| East | $1,268,450 | 96,400 | 12.4% | 1.14m | 2024-04-02 | 1,268,450 per [plan 96,400](plans/east-7.md) |
| West | $3,710,900 | (204,700) | 36.2% | 2.37m | 2024-04-09 | `run 204,700` then 3,710,900 |
| Online | $52,480 | 8,120 | 0.5% | 0.04m | 2024-04-11 | 52,480 |
```

The table holds five revenue figures, with a number in the header row and in two cells of the first column. The Notes column holds numbers inside links and inside inline code, beside plain numbers.

Run `/simplify-data`. Expect the status entry to show, the columns to stay aligned, and the table to hold these values. Every number inside a link or inline code keeps its digits:

```text
| Region | Revenue 2024 | Change | Share | Costs | Updated | Notes |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| North 12 | $4,000,000 | 400,000 | 40% | 3.5m | 2024 | [report 4,236,000](reports/north-12.md) |
| South 7 | $1,000,000 | (20,000) | 9.5% | 0.8m | 2024 | `983,321` |
| East | $1,500,000 | 95,000 | 10% | 1m | 2024 | 1,500,000 per [plan 96,400](plans/east-7.md) |
| West | $3,500,000 | (200,000) | 35% | 2.5m | 2024 | `run 204,700` then 3,500,000 |
| Online | $50,000 | 8,000 | 0.5% | 0.04m | 2024 | 50,000 |
```

A failure shows as columns that no longer align, or as a dim line that reports a skipped hook.

Run `/simplify-data` again. Expect the table as the model wrote it, and no status entry.
