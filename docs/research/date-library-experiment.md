# Date library experiment: compromise

> **Status (2026-11-26): open.** This note records an experiment and grows as
> further runs are made. The harness and its raw results are not committed.

## Question

The shared library reads dates and times through four readers: an ISO
date-time reader, a date reader (six date shapes and a year that fills the
cell), a clock time reader, and a reader for a year beside an era marker.
Can one general library replace all four? The experiment measures three
outcomes:

- **Simplicity.** Does the library cover every case the readers cover?
- **Performance.** What does the library cost in time?
- **Other impact.** Size, dependencies, and stability of the results.

The library tested is compromise 14.20.0 with its dates add-on,
compromise-dates 3.11.0.

## Method

A harness runs the current readers and the library on the same texts and
compares the stretches each one reads. The library sits behind one adapter, so
another library takes one adapter file and one line in the runner.

The texts, 1,864 distinct in all:

| Set | Texts | Source |
|---|---:|---|
| tests | 1,342 | Text literals that hold a digit, from the three JavaScript test suites |
| test page | 426 | The cells of the manual test page |
| judgement | 96 | Hand-written shapes that must not read as a date, and borderline shapes |

Each text gets one outcome, the most severe among its values:

| Outcome | Meaning |
|---|---|
| different reading | Both read a value in the same place and the readings differ |
| missed | The current readers read a value and the library reads none |
| extra | The library reads a value where the current readers read none |
| different span | Same reading, different start or end in the text |
| one reading of two | An ambiguous date: the library returns one reading and no mark that a second exists |
| same | Same reading, same span |

The current readers are the reference because the test suites pin their
behavior. The reference is not always right; see
[Findings about the current readers](#findings-about-the-current-readers).

An independent review of the harness found defects that made the library look
worse: clock times counted twice, code fragments among the test texts, a
timing order that slowed the library's figure by about a quarter, and one
figure for the day's position that mixed two causes. The figures below hold
the corrections. One defect in the library's favor remains: in 5 texts, a date
the library found and could not read counts as an impossible date, which
agrees with the reference.

## Results

### Agreement

| Outcome | tests | test page | judgement | Total |
|---|---:|---:|---:|---:|
| different reading | 27 | 8 | 2 | 37 |
| missed | 20 | 4 | 4 | 28 |
| extra | 57 | 22 | 27 | 106 |
| different span | 61 | 16 | 4 | 81 |
| one reading of two | 22 | 10 | 2 | 34 |
| same | 94 | 10 | 6 | 110 |
| neither reads a value | 1,061 | 356 | 51 | 1,468 |

Of the 396 texts where either side reads a value, the two agree in full on
110.

Examples, all measured:

- **extra:** "January", "Mon", "Q4", "summer", and "Last 90 days" read as
  dates. "2.1.70" reads as 1 February 1970. "53% of 1,234" reads as the year
  1234. The column heading "Clock, last hour" reads as a time.
- **missed:** "1975", "1998", and "2096" as the whole text. Every year beside
  an era marker ("500 BC", "2898 AD").
- **different reading:** "9:45 - 11:45 AM" comes back as one time, 9:45.
  "03/04/2026: 12,345" comes back as one date phrase with no reading.
  "2025-11-26T24:00" comes back with no reading for the date as well as the
  time.
- **different span:** an ISO date-time is one span, where the current readers
  split the date from the time. A leading "on" or "at" joins the span.

### Position of the day

The month granularity removes the day from a date, so the code needs the
day's position in the text. Of the 190 dates in the texts that hold a day:

| Result | Dates |
|---|---:|
| The library gives the day's position | 35 |
| The library reads the date and gives no position for the day | 128 |
| The library reads no usable date | 27 |

The library gives a position per word. A numeric date such as "2020-07-21" is
one word, so its parts carry no positions.

### Speed

| Measure | Current readers | Library |
|---|---:|---:|
| First load and first read | 8.5 ms | 149 ms |
| One text, average over all texts | 5.6 µs | 429 µs |
| A table of 10,000 cells | 49 ms | 3.8 s |
| One cell holding 200 values | 0.3 ms | 75 ms |
| One cell holding 2,000 values | 2.8 ms | 5.1 s |

The library is about 77 times slower per text. The independent review measured
the split, which this experiment did not rerun: about 130 µs to label the
words and about 270 µs to resolve the dates, with the date step growing with
the square of the number of dates in one text. The review found one faster
documented mode, about 1.4 times faster, and that mode changed the reading of
152 texts.

### Size

| Measure | Current date module | Library |
|---|---:|---:|
| Files a product ships | 17 KB | 475 KB |
| The same, compressed | 6 KB | 189 KB |
| Code lines | 156 (reading code only) | 71 (the adapter, which only translates) |

The 17 KB includes the code that writes a simplified date or time, which stays
in either case.

### Other impact

- **Results change with the calendar.** A date with no year resolves against
  today: "May" read in November 2026 comes back as May 2027.
- **Dependencies.** The library and its add-on bring six packages. The
  repository installs none today, and the Sheets library and the plugin
  library are built by joining source files.

## Why the library differs

The library reads sentences. It labels every word with a part of speech, then
reads a date from the labels and from the words on either side. A table cell
often holds one value and no words on either side.

The library's own year rule, read from its source: a four-character number
from 1401 to 2099 is a year when a neighbouring word is a date word ("in",
"since", "by", "of", and others), a date, or a proper noun. From 1920 to 2024,
weaker clues also count, such as "is" or "was" beside it.

Measured, one year per text from 1900 to 2099: the library reads a lone number
as a year from 2000 to 2059 only. With a cue it reads the others ("in 1975",
"since 1984"). Without one it does not ("Founded 1998", "FY 1999",
"1975 results", "Sales: 2020").

The same cause explains the extra readings (in a sentence "May" and "Mon"
usually are dates), the cost (every word is labelled before any date is
sought), and the phrases with no reading (neighbouring words join one date
phrase).

## Custom tagging rules

The library documents custom rules: a rule matches a pattern of words and
labels, then adds or removes a label. Its dates add-on documents the same
calls for making date reading greedier. Two rule sets were run on four-digit
numbers from 1800 to 2100.

- **Rule 1:** a number of that shape that is the whole text is a year.
- **Rule 2:** every number of that shape is a year, unless a plural noun
  follows it (a count of things), or a singular noun stands before it at the
  end of the text (a label and its number).

| Text | Current readers | Library alone | Rule 1 | Rule 2 |
|---|---|---|---|---|
| 1900 | year | number | year | year |
| 1975 | year | number | year | year |
| 1800 | number | number | year | year |
| 2100 | number | number | year | year |
| 1799, 2101 | number | number | number | number |
| in 1900 | number | year | year | year |
| Founded 1998 | number | number | number | year |
| FY 1999 | number | number | number | year |
| Sales: 2020 | number | number | number | year |
| 2019 revenue | number | number | number | year |
| Revenue 2019 | number | number | number | number |
| Room 2020 | number | number | number | number |
| 1975 results | number | number | number | number |
| 1900 units | number | number | number | number |
| Population 1900 | number | number | number | number |

What the rules can and cannot do, all measured:

- **A rule reaches the dates reader.** After rule 1, the add-on reads "1975"
  as the year 1975.
- **A rule's pattern does not see a thousands separator.** The library strips
  the comma before the pattern runs, so both rules read "1,900" as a year.
  The text as written is still available, and a rule that also checks it reads
  "1,900" as a number and "1900" as a year.
- **Grammar separates some cases.** A plural noun after the number marks a
  count: "1900 units" stays a number.
- **Grammar cannot separate two meanings that share one shape.** "1975
  results" and "1900 units" are both a number and a plural noun. "Revenue
  2019" and "Room 2020" are both a singular noun and a number. Rule 2 reads
  each pair alike, so it is wrong on one of each pair.

Rule 1 is the current reader's rule for a year that fills the cell, with a
wider range, written in the library's rule format.

## The test sentence

"in 2007, the 2006 election found 2007 faults in riding 2007"

The expected column is a judgement, not a tested expectation.

| Number | Expected | Current readers | Library alone | Rule 2 |
|---|---|---|---|---|
| in **2007** | year | number | year | year |
| the **2006** election | year | number | number | year |
| found **2007** faults | count | number | number | number |
| riding **2007** | label number | number | number | year |

The current readers read no date in the sentence, so the product treats all
four as numbers. The library alone reads one year of the two. Rule 2 reads
both years and the count, and reads the riding number as a year: the library
labels "riding" a verb, so the label-and-number exception does not apply.

## A timeline text

A heading line "2021" followed by five lines of prose, each starting with a
month and a day ("January 6: 2021 United States Capitol attack",
"January 13–February 13: … from February 9–13."). Each line ran as its own
text, and all six ran as one text.

| | Current readers | Library alone |
|---|---|---|
| The heading "2021" | year | year |
| The seven month-and-day dates with no year | none read | all seven read |
| The year of those seven dates | — | 2027, a year the library takes from the run date; the heading year does not reach them |
| "January 6: 2021 United States…" | none read | one date, 6 January 2021: the event's name supplies the year across the colon |
| "January 13–February 13" | none read | two dates, not one range |
| "February 9–13" | none read | one range |
| "first", "second time" | none read | none read |

The year rule changes no reading in this text.

As one text, the current readers join the heading and the next line into one
date, "2021" + line break + "January 1", because the year-month-day shape
accepts any whitespace between its parts.

## Use as a finder of missed shapes

The library has one use that ships nothing: in development, the harness lists
every text where the library reads a date or time and the current readers read
none. Size and speed do not matter there. Most of the 106 "extra" texts are
false readings ("Mon", "Q4", "summer"). The rest are shapes the current
readers skip, all measured:

| Shape | Examples | The library's reading |
|---|---|---|
| A month and a day, no year | "January 13", "Nov 3", "dec 5", "5 Mar" | The day, in a year the library takes from the run date: 2026 for "Nov 3" and "dec 5", 2027 for "January 13" and "5 Mar", run on 26 November 2026 |
| A dotted date | "21.06.2020", "2020.06.21" | 21 June 2020 |
| A clock time with no minutes | "6pm", "6 pm" | 18:00 |
| A clock time with "h" | "18h30" | 18:30 |
| A month and a two-digit number | "Jan-20", "Mar-21" | 20 January and 21 March; the text may mean January 2020 and March 2021 |
| A quarter and a year | "Q1 2020" | A span of three months |
| A named time | "noon", "midnight" | 12:00 and 0:00 |

The library also checks a day against its month: it returns no reading for
"Feb 30, 2020" and "2/30/2020", which the current readers accept.

Each row is a candidate shape for the current date and clock time readers.
Whether a shape should simplify is a product question, and none of the shapes
has been built.

## Findings about the current readers

- The date reader accepts a day of 1 to 31 in any month, so "Feb 30, 2020"
  reads as a date. The library returns no reading for it.
- The year-month-day shape reads across a line break; see
  [A timeline text](#a-timeline-text).
- The readers read a date inside a web address or a product code. The
  classification ladder holds a cell that an identifier shape fills before the
  readers run, so some "missed" texts are not losses in the product: about 6
  of the 28, by the review's estimate.

## Conclusion so far

The library does not replace the readers.

- **Simplicity:** the adapter would need the current shape rules to find the
  day in 128 of 190 dates, to split a date-time, to read two times in a range,
  to mark an ambiguous date, and to read era years, plus new rules to block
  106 extra readings.
- **Performance:** about 77 times slower per text, and seconds for a cell
  holding thousands of values.
- **Other impact:** 28 times the size, six packages, and readings that change
  with the calendar.

The library does one thing the readers do not: it reads a year from the words
around it in a sentence. Custom rules raise that further and stay limited by
texts where one shape holds two meanings.

Its use with no cost to a product is in development; see
[Use as a finder of missed shapes](#use-as-a-finder-of-missed-shapes).

## Open items

- Whether a year inside a sentence should be read as a date at all is a
  product question, separate from the choice of library.
- The rule sets above ran on 21 texts. They have not run on the full set of
  texts.
