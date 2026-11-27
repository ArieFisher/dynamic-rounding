# Spike: first measurement of the extension tests

Plan: [docs/sprint-plans/test-dedup.md](../sprint-plans/test-dedup.md), spike `first-measurement`.
Question: is the planted bug data good enough to drive the trimming?

**Result:**

## Run

- Measured on 2026-11-27, with the script from #836, at its branch head `4834611`. That commit's product code matches `main` at `4a69978`.
- Elapsed time: 1,195 seconds (about 20 minutes), with 7 workers: 506 milliseconds per planted bug. The plan estimated hours.
- Clean runs: 7.1 seconds each. Time cap: 21.4 seconds.

## Planted bugs

| Outcome | Count | Share of caught |
| --- | ---: | ---: |
| Caught by assertions | 1,627 | 85.8% |
| Caught by a crash | 268 | 14.1% |
| Caught by a timeout | 1 | 0.1% |
| Not caught | 455 | |
| Invalid | 11 | |
| Total | 2,362 | |

The plan's test for a thin "repeats others" list is whether crashes and timeouts credit no assertion for most caught planted bugs. They hold 14.2% of the caught planted bugs, so that test passes.

Uncaught planted bugs are most frequent in the sidebar (95), the table adapters (58), the pillbox view (41), and the content script (39).

## Assertions

4,621 assertions. No flaky assertion across the three clean runs. 8 assertion identities repeat.

| Piece | Catches nothing | Repeats others | Unique |
| --- | ---: | ---: | ---: |
| number | 135 | 728 | 49 |
| detection | 211 | 563 | 51 |
| rounding pass | 134 | 588 | 54 |
| source checks | 290 | 42 | 23 |
| ladder | 9 | 317 | 18 |
| controller | 99 | 196 | 30 |
| sidebar | 87 | 130 | 31 |
| table registration | 73 | 143 | 14 |
| pillbox | 47 | 107 | 21 |
| capture log | 72 | 57 | 36 |
| table kinds | 10 | 104 | 5 |
| bus | 37 | 30 | 10 |
| table step | 16 | 33 | 6 |
| helpers | 15 | 0 | 0 |
| **Total** | **1,235** | **3,038** | **348** |

## What the lists hold

- **Repeats others: 3,038 assertions, 66%.** The plan's trim was to go ahead if 20% or more repeat. 348 assertions catch every planted bug that assertions catch.
- **Catches nothing: 1,235 assertions.** The source checks piece and the helpers it calls hold 305 of them; those check code text, so they catch nothing by design. The other 930 check product rules. The `tests-that-catch-nothing` sprint assumed 10 to 30.
- **One cause behind both sizes, checked in the script and the lists.** The lexer skips string text and regular expressions, so no planted bug ever changes one. Three reader files for numbers and dates hold about 50 lines that call a regular expression (counted by a search), and much of their logic sits in those expressions. When two tests send different inputs through different expressions, the planted bugs change only the code the two share, so every planted bug one test catches the other catches too, and the sort lists one of them under "repeats others". For example, the month case table rows for "December 13, 2096" and "Dec 13, 2096" both sit on that list, although each checks a different date form. In the same way, a test that checks that the reader finds no number in a malformed input catches nothing, because no planted bug makes the reader accept that input.
