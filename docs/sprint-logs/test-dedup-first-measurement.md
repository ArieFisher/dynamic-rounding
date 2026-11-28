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
- **First explanation tested: the lexer skips patterns.** The first planted bug table never changed string text or a regular expression, and the number and date readers do much of their work in patterns. The month case table rows for "December 13, 2096" and "Dec 13, 2096" both sit on the "repeats others" list, although each checks a different date form. The second measurement below tests this explanation.

## Second measurement: planted bugs in patterns

The script from #839 also removes a quantifier, an alternative, a character class member, or an anchor inside a pattern. Measured on 2026-11-27 at that branch's commit `5c1c2c0`, whose product code matches `main`. Elapsed time: 1,449 seconds, with other test runs sharing the computer.

| Outcome | Count | Share of caught |
| --- | ---: | ---: |
| Caught by assertions | 1,787 | 86.7% |
| Caught by a crash | 270 | 13.1% |
| Caught by a timeout | 4 | 0.2% |
| Not caught | 593 | |
| Invalid | 11 | |
| Total | 2,665 | |

The 303 pattern planted bugs: 160 caught by assertions, 2 by a crash, 3 by a timeout, 138 not caught.

| List | First measurement | Second measurement |
| --- | ---: | ---: |
| Catches nothing | 1,235 | 1,206 |
| Repeats others | 3,038 | 3,030 |
| Unique | 348 | 385 |
| Flaky | 0 | 0 |

The lists barely moved, so the skipped patterns explain little of their size. The two month rows still sit on "repeats others": other assertions with the same month names catch the same pattern planted bugs.

## What the lists measure

- **"Repeats others" holds an assertion when no planted bug separates it from the assertions kept before it.** It does not show that two tests check the same thing. 1,787 planted bugs are caught by assertions, against 4,621 assertions, so most assertions cannot hold a planted bug that only they catch. In the second measurement, 3,415 assertions catch at least one planted bug, with a median of 8 each. 2,067 of them share an identical catch list with another assertion; the rest of the "repeats others" list is covered by a mix of several kept assertions.
- **"Catches nothing" holds an assertion when no planted bug makes it fail.** 304 of the 1,206 check code text, so they catch nothing by design. Some of the other 902 check that an input is refused, such as a test that the reader finds no number in "N/A"; a planted bug rarely makes code accept more input. A search of their names for refusal wording ("no number", "yields no", "fallback", "unchanged", "null") finds 69; the rest were not classified. An assertion on this list is not shown to pass whatever the code does.
- **The proof holds.** `prove` fails when a branch loses a caught planted bug, whatever the lists say. A trim that relies on the proof alone keeps every caught planted bug, but it can delete a test that checks an input form no planted bug reaches.
- **Not caught: 593 planted bugs.** Each is a change to product code that no test detects. The most sit in the sidebar (96), the date reader (87), the table adapters (58), the identifier reader (50), and the capture renderer (45).
