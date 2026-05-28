# Dynamic Rounding

Numbers can tell a story. But *too many* numbers make the story hard to see.

This introduces a new approach to making data interpretable: **declarative simplification**.

## Simplifying data: declarative  vs. imperative

A traditional way to simplify data is to round it.

Rounding is sometimes helpful but it's a blunt tool that can obscure the story as easily as reveal it.  Consider this before-and-after - the after is more clear but the story has been destroyed.

| original value | \=ROUND(A2, \-6) |
| :---- | :---- |
| 7,514,321 | 8,000,000 |
| 7,464,329 | 7,000,000 |
| *difference* | *difference* |
| **49,992** | **1,000,000** |

*In the original table it was hard to read the story (that the comparison is nearly identical).  In the simplified table it's easy to read -- the wrong story (that the numbers are very far apart).* 

This library is a way to reveal the story in data. e.g.

| original value | `=round_dynamic(a2:a3)` |
| :---- | :---- |
| 7,514,321 | 7,500,000 |
| 7,464,329 | 7,500,000 |
| *difference* | *difference* |
| **49,992** | **≈ 0** |

*The simplified numbers tell the actual story: these two numbers really are 'about the same'.*

## Choosing a lens

Every dataset is different and a tool for simplifying it has to be flexible enough to look at it in different ways while hunting for the story in it.  The users of this library can dial the lens, ratcheting it up or down, by adjusting a single parameter.  This is the 'declarative' part of the library - the user declares a lens for the entire dataset, one parameter: an **offset** from the number's **order of magnitude**.

### Declarating a lens

Depending on the situation, a number like **87,054,321** may be interpreted differently: it could mean anything from 'unimportant' to 'unfathomably large'.  This library lets users step the lens up or down until the numbers say something meaningful.


| lens (i.e. a simplified representation of the data) | Declarative lens: round this number to the… | Imperative command: round this number to the…  |
| :---- | :---- | :---- |
| 100,000,000 | … next larger order of magnitude <br> <br> `=round_dynamic(A1, 1)` | … nearest hundred million <br> <br> `=ROUND(A1 / 100000000, 0) * 100000000` |
| 100,000,000 | … half-step toward the next-larger order <br> <br> `=round_dynamic(A1, 0.5)` | … nearest 50 million <br> <br> `=mround(A1, 50000000)` |
| 90,000,000 | … current order of magnitude  <br> <br> `=round_dynamic(A1, 0)` | … nearest 10 million  <br> <br> `=round(A1, -7)` |
| 85,000,000 | … half-step within the current order  <br> <br> `=round_dynamic(A1, -0.5)` | … nearest 5 million  <br> <br> `=mround(A1, 5000000)` |
| 87,000,000 | … one order finer  <br> <br> `=round_dynamic(A1, -1)` | … nearest million  <br> <br> `=round(A1, -6)` |


Each setting emphasizes different relationships in the data.  The goal is not precision — it is interpretability.

The sign of a fractional offset tells the function which way to step. A positive `+0.5` rounds to half of the **next-larger** order of magnitude; a negative `-0.5` rounds to half of the **current** order. This generalizes to any non-integer offset: the step size is `|frac(offset)| × 10^(OoM + ceil(offset))`.

### Floor at the value's order of magnitude

Rounding can never collapse a number below its own order of magnitude. For any value, the simplified result is guaranteed to have a magnitude of at least `10^floor(log10(|value|))`, with sign preserved.

For example, `=round_dynamic(87054321, 2)` (asking to round to the nearest hundred million) returns **10,000,000**, not `0`. A tens-of-millions value never simplifies to zero, regardless of how aggressive the requested offset is. This keeps ordering intuitive when a dataset spans many magnitudes.

### Backward compatibility

The default offset (`-0.5`) is unchanged: every call that relies on the default — single mode or dataset mode — produces the exact same value it did before. Callers that explicitly pass a *positive* non-integer offset (`+0.5`, `+0.25`, `+1.5`, etc.) will see different values than in earlier versions: positive fractional offsets previously produced the same result as their negative counterparts (a latent bug), and now correctly step toward the next-larger order of magnitude.


## Simplifying ranges

The declarative nature makes simplifying data less fiddly.  But it starts to shine when used to simplify entire ranges of data in one step.

| original matrix |  |      | \=ROUND\_DYNAMIC(A2:B9) |  |
| --- | --- | --- | --- | --- |
| col 1 | col2 |    --->    | col 1 | col2 |
| 87,054,321 | 129,972,101 |  | 85,000,000 | 150,000,000 |
| 84,654,321 | 126,388,901 |  | 85,000,000 | 150,000,000 |
| 22,484.49 | 33,569.34 |  | 20,000 | 35,000 |
| 2,484.49 | 3,709.34 |  | 2,500 | 3,500 |
| \-22,484.72 | \-33,569.69 |  | \-20,000 | \-35,000 |
| 36.10% | 53.90% |  | 35% | 55% |
| \-2.80% | \-4.18% |  | \-3% | \-4% |


## Adaptive precision

Smaller values can be simplified more aggressively without affecting the overall structure of the data.

In this example, the largest values are rounded to the nearest half order of magnitude `(0.5)`, while smaller values are rounded more.


| original value | `=round_dynamic(A1:A7, -0.5, 0)` | notes |
| :---- | :---- | :---- |
| 87,054,321 | 85,000,000 | In this data, the largest numbers are ‘tens of millions’.  They get simplified by being rounded to the nearest ***half*** order of magnitude.  <br><br> This lighter touch preserves more fidelity to the original value. |
| 84,654,321 | 85,000,000 |  |
| 23,484.49 | 20,000 | Any number smaller than ‘tens of millions’ are simplified by being to the full order of magnitude. <br><br> In this case the number is ‘tens of thousands’ and it gets rounded to the nearest ten thousand. <br><br> More aggressive rounding of smaller numbers improves readability (signal) while minimizing impact on the fidelity of the dataset as a whole. |
| \-23,484.72 | \-20,000 |  |
| 2,484.49 | 2,000 | number in the thousands → nearest thousand |
| 36% | 40% | a decimal (0.36) in ‘tenths’ → nearest ten percent |
| \-2.8% | \-3% |  |

This balance preserves structure in large numbers while improving overall readability, especially in larger and more complicated datasets.

## Features

1. **Declarative rounding**:  relative to magnitude  
2. **Range operations**: preserves structures of arrays, lists, or grids  
3. **Iteration**: use the relative rounding approach that is best for your data  
4. **Adaptive precision**: Simplify smaller numbers more aggressively while preserving precision in larger ones.  
5. **Robust**: passes through non-numerics, handles negatives and decimals, ignores non-numerics, tolerates different number formats

---

## Implementations

| Platform | Location | Install |
| :---- | :---- | :---- |
| Google Sheets | [js/](https://www.google.com/search?q=./js/) | [Copy template](https://docs.google.com/spreadsheets/d/1GdHvYk3dVzJErrGH7yDULW6srM0gaHeYMGMn3k0-GY4) |
| Python | [python/](https://www.google.com/search?q=./python/) | pip install dynamic-rounding |
| Chrome Extension | [chrome-extension/](https://www.google.com/search?q=./chrome-extension/) | [Load unpacked](https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked) |

## Quick Examples

### Chrome Extension
![alt-text](docs//dynamic_rounding_Screen.gif)

see [Chrome Extension README](chrome-extension/README.md)

### Google Sheets

* \=ROUND\_DYNAMIC(87054321) \-\> 85,000,000  
* \=ROUND\_DYNAMIC(A1:A10)   \-\> rounds entire range with set-aware precision

### Python

* `from dynamic_rounding import round_dynamic`  
* \# Single value: `round_dynamic(87054321)` \-\> 85,000,000  
* \# Dataset: (larger values get finer precision):  `round_dynamic([4428910, 983321, 42109])` \-\> \[4,500,000, 1,000,000, 40,000\]

### Python with pandas

* `from dynamic_rounding.pandas import round_dynamic_series`  
* \# round entire series with set-aware precision:  
* `round_dynamic_series(df['revenue'])`

--- 

## Documentation

* [Design Doc](https://www.google.com/search?q=./docs/design.md) — Algorithm and concepts  
* [Google Sheets README](https://www.google.com/search?q=./js/README.md) — Full Sheets documentation  
* [Python README](https://www.google.com/search?q=./python/README.md) — Full Python documentation
* [Chrome Extension README](https://www.google.com/search?q=./chrome-extension/README.md) — Browser-based simplification

## License

MIT


<br><br><br><br>
# Appendix

## An example of reading a story from data

Data can encode information it was not designed to reveal. For example, this invoice reveals read a company's business model, underlying architectural beliefs and transformation goals.

| Service Name | Cloud Bill |
| :---- | :---- |
| Cloud CDN | $4,228,910.4100 |
| Cloud Storage | $3,812,105.5929 |
| Cloud Load Balancing | $1,011,204.393 |
| BigQuery | $824,479 |
| Cloud Dataflow | $62,583.3113 |
| Cloud Dataproc | $43,937.77 |
| Cloud Pub/Sub | $9,911.21 |
| Compute Engine | $17.24 |
| *source: kaggle.com* |  |

Let's hunt for signal:

| Service Name | Simplified | Observations |
| :---- | :---- | :---- |
| Cloud CDN | 4,250,000 | This company 'serves': Web or media platform? |
| Cloud Load Balancing | 3,750,000 | High traffic volume:  globally-popular? |
| Cloud Storage | 1,000,000 | Significant storage footprint: serving media (e.g. streaming video)?  Gaming unlikely (too compute-intensive) |
| BigQuery | 800,000 | Data platform: logs (a streaming company) and business intelligence? |
| Cloud Dataflow | 65,000 | Real-time processing pipeline: streaming telemetry?   Spend relative to BigQuery is low: an experiment? |
| Cloud Pub/Sub | 45,000 | Streaming ingestion layer? |
| Cloud Dataproc | 10,000 | Batch: analytics?   Lower spend than Dataflow: company prioritizes streaming: log processing? |
| Compute Engine | 15 | Minimal usage of raw infrastructure:  prefer managed/serverless? |
| *If this interpretation feels obvious, try re-reading the raw invoice first and check if these observations jump out at you.* |  |  |

**TL;DR**  
This invoice suggests a large-scale content platform undergoing a **transition from centralized analytics toward a split architecture: real-time streaming plus batch processing**, with strong reliance on managed services.

**Key Narratives**

- **Business model**: A global-scale content or media-serving platform with heavy delivery and storage demand.  
- ***Architectural beliefs***: \- Near-zero Compute Engine spend suggests a strong preference for managed/serverless infrastructure.  
- ***BigQuery Decomposition*****:** BigQuery is still the system of record (nearly 10:1 cost vs. other data solutions) as the team experiments with streaming log ingestion and lower-cost batch processing (while respecting its preference for managed services).  
- ***Streaming over Batch***: The 10:1 ratio between streaming ($110,000) and batch ($10,000) shows a company that prioritizes immediacy, processing CDN telemetry in real-time to detect errors, fraud, or performance dips.  
- ***Logs over Analytics***: The combined cost of the data pipeline suggests that the logs themselves are the "nerve system" of the business, enabling real-time tuning of the $4.25M CDN spend.