# DynamicRounding for Claude Code

The Claude Code plugin simplifies the numbers in the markdown tables of a session. It changes what the transcript shows and leaves the model's reply as written.

## Install

At the prompt of a terminal session:

```
/plugin install dynamic-rounding --marketplace ArieFisher/dynamic-rounding
```

## Use

Run `/simplify-data`, the toggle command. Every markdown table in the transcript shows simplified numbers, and the status entry "simplify-data: on" shows. Run the command again, and every table shows as the model wrote it.

- The plugin is off at the start of every session.
- The engine keeps each reply block as the model wrote it. While the plugin is on, press ctrl+o to see the originals.
- Numbers in prose stay as written. A table inside a fenced code block stays as written too.

## What simplifies

The plugin reads each cell of a markdown table the way the Chrome extension reads a table cell, under the extension's default settings. It has no settings of its own.

- The header row and the first column stay as written.
- A number rounds to the nearest half of its own order of magnitude.
- A currency amount, a percentage, a bracketed number, and a unit number round their digits and keep their marks.
- A date simplifies to its year. A time stays as written.
- An identifier shape, such as a phone number, an IP address, or a web address, stays as written.

The plugin test prompt below holds one column of each kind.

## Known limits

- A number that identifies a thing rounds when it has no identifier shape: a line number, an issue number, a port, the leading digits of a commit hash. The transcript shows "entry.js:148" as "entry.js:150", "#718" as "#700", and "8080" as "8,000".
- A number inside inline code or inside a link rounds like any other number. A relative link's target counts: the transcript shows "docs/sprint-12/plan.md" as "docs/sprint-10/plan.md".

Turn the plugin off to read such a table as written.

## Plugin test prompt

The plugin draws no page, so its manual test runs on a table the model writes. From the repository root, start a terminal session with `claude --plugin-dir claude-code-plugin`, and send this prompt:

```text
Write this markdown table exactly as it is, with no other text:

| Region | Revenue 2024 | Change | Share | Costs | Updated |
| --- | ---: | ---: | ---: | ---: | --- |
| North 12 | $4,236,000 | 412,300 | 41.3% | 3.31m | 2024-03-15 |
| South 7 | $983,321 | (18,250) | 9.6% | 0.82m | 2024-03-18 |
| East | $1,268,450 | 96,400 | 12.4% | 1.14m | 2024-04-02 |
| West | $3,710,900 | (204,700) | 36.2% | 2.37m | 2024-04-09 |
| Online | $52,480 | 8,120 | 0.5% | 0.04m | 2024-04-11 |
```

The table holds five revenue figures, with a number in the header row and in two cells of the first column.

Run `/simplify-data`. Expect the status entry to show, the columns to stay aligned, and the table to hold these values:

```text
| Region | Revenue 2024 | Change | Share | Costs | Updated |
| --- | ---: | ---: | ---: | ---: | --- |
| North 12 | $4,000,000 | 400,000 | 40% | 3.5m | 2024 |
| South 7 | $1,000,000 | (20,000) | 9.5% | 0.8m | 2024 |
| East | $1,500,000 | 95,000 | 10% | 1m | 2024 |
| West | $3,500,000 | (200,000) | 35% | 2.5m | 2024 |
| Online | $50,000 | 8,000 | 0.5% | 0.04m | 2024 |
```

A failure shows as columns that no longer align, or as a dim line that reports a skipped hook.

Press ctrl+o. Expect the originals.

Run `/simplify-data` again. Expect the table as the model wrote it, and no status entry.
