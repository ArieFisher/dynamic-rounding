# Make data readable

Data can tell rich stories, but sometimes the numbers get in the way.

For example: can you see the story in this?

> Jan-Dec: $19,752.96, $22,222.08, $18,518.40, $24,691.20, $24,675.40, $18,518.40, $0.00, $3,703.68, $24,580.60, $24,691.20, $22,222.08, $19,752.96

*pattern*: revenue drops during summer and winter breaks \
*story*: a business cycle tied to the academic calendar

This rendering of the same data makes the pattern (and by extension the story) easier to see.

![chart showing revenue](docs/media/revenue_chart_3.png)

<p align="center"><sup>I see a story of consistent revenue that falls off a cliff in July/August, and returns immediately. Once we look closely, we can see Spring Break and Winter Vacation, even Thanksgiving.</sup></p>

We are pretty good at finding patterns in data, but sometimes the data works against itself, particularly when it comes at us in lists or even tables of overly-specific numbers.

So without actually graphing it, is there a way to instantly simplify data to the point that we can uncover its patterns and stories simply with visual inspection?  That is what this library attempts.  

This library makes data more readable, helping us see its patterns that allow us to find the story within.

## Implementations

| Platform | Location | Install |
| --- | --- | --- |
| Google Sheets | [js/](./js/) | [Copy template](https://docs.google.com/spreadsheets/d/1GdHvYk3dVzJErrGH7yDULW6srM0gaHeYMGMn3k0-GY4) |
| Python | [python/](./python/) | `pip install dynamic-rounding` |
| Chrome Extension | [chrome-extension/](./chrome-extension/) | [Load unpacked](https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked) |

## Quick Examples

### Chrome Extension

[1 minute video demo](https://share.descript.com/view/Y76MAoqM06p)

The extension rounds numbers *in place* on any web page.

In other words, you do not have to copy a table and paste it into a spreadsheet to simplify it. You can visit your existing database, website, or SaaS tool and see simplified numbers that make the story easier to grasp.

See the [Chrome Extension README](chrome-extension/README.md).

### Google Sheets

A spreadsheet is one of the best tools for quickly exploring data. This library includes a custom function that can **declaratively simplify** an entire dataset.  

- `=ROUND_DYNAMIC(87054321)` → 85,000,000
- `=ROUND_DYNAMIC(A1:A10)` → rounds the whole dataset

The defaults handle most cases, and advanced users can tweak its output to put different ‘lenses’ on the data, to look at it in ways that their specific situation calls for.

### Python

#### Simple python:

Data professionals may explore their data with python libraries.

- `from dynamic_rounding import round_dynamic`
- Single value: `round_dynamic(87054321)` → 85,000,000
- Dataset: `round_dynamic([4428910, 983321, 42109])` → \[4,500,000, 1,000,000, 40,000\]

#### with pandas:

- `from dynamic_rounding.pandas import round_dynamic_series`
- Entire series:  `round_dynamic_series(df['revenue'])`

---

## Documentation

- [Design Doc](docs/design.md) — Algorithm, concepts, and the extension's architecture
- [Vocabulary](docs/vocabulary.md) — One term per concept, across every platform and document
- [Google Sheets README](js/README.md) — Full Sheets documentation
- [Python README](python/README.md) — Full Python documentation
- [Chrome Extension README](chrome-extension/README.md) — Browser-based simplification

## License

MIT
