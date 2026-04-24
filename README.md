# Dynamic Rounding

Numbers can tell a story—but when they’re too numerous or too complex, they can obscure the structure that makes that story clear.

This library introduces a new approach to making data interpretable: **declarative simplification**.

## Simplifying data: declarative  vs. imperative

Rounding is the traditional way to simplify data—but it’s a blunt tool that can obscure the story.

| original value | \=ROUND(A2, \-6) |
| :---- | :---- |
| 7,514,321 | 8,000,000 |
| 7,464,329 | 7,000,000 |
| *difference* | *difference* |
| **49,992** | **1,000,000** |

This isn’t just a new rounding function—it’s a different way to make the story in data visible.

| original value | `=round_dynamic(a2)` |
| :---- | :---- |
| 7,514,321 | 7,500,000 |
| 7,464,329 | 7,500,000 |
| *difference* | *difference* |
| **49,992** | **≈ 0** |

These two numbers really are 'about the same' \- the simplified data tells the right story.

## Choosing a lens

Different datasets require different levels of simplification. This is controlled with a single parameter: an offset from the nearest order of magnitude.

| declarative intent: ‘against a number of tens of  millions, round to …’ | original value:  87,054,321 | interpretation | using the optional offset |
| :---- | :---- | :---- | :---- |
| … nearest hundred million | 100,000,000 | one order coarser | `=round_dynamic(A1, 1)` |
| … nearest ten million | 90,000,000 | current order or magnitude | `=round_dynamic(A1, 0)` |
| … nearest five million | 85,000,000 | half-step within order | `=round_dynamic(A1, -0.5)` |
| … nearest million | 87,000,000 | one order finer | `=round_dynamic(A1, -1)` |

## Simplifying ranges

You can use this library to simplify entire ranges of data in one step.

| original value | `=round_dynamic(A1:A7)` |
| :---- | :---: |
| 87,054,321 | 85,000,000 |
| 84,654,321 | 85,000,000 |
| 22,484.49 | 20,000 |
| 2,484.49 | 2,500 |
| \-22,484.72 | \-20,000 |
| 36.1% | 35% |
| \-2.8% | \-3% |

#### Iterating

Changing a single parameter applies a different lens to the same data, making it easy to explore multiple interpretations

| original value | \+1 OoM (1) | Current OoM (0) | half (default) (-0.5) | quarter (-0.25) | 1 smaller OoM(-1) | (-1.5) |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| 87,054,321 | 100,000,000 | 90,000,000 | 85,000,000 | 87,500,000 | 87,000,000 | 87,000,000 |
| 84,654,321 | 100,000,000 | 80,000,000 | 85,000,000 | 85,000,000 | 85,000,000 | 84,500,000 |
| 22,484.49 | 0 | 20,000 | 20,000 | 22,500 | 22,000 | 22,500 |
| 2,484.49 | 0 | 2,000 | 2,500 | 2,500 | 2,500 | 2,500 |
| \-22,484.72 | 0 | \-20,000 | \-20,000 | \-22,500 | \-22,000 | \-22,500 |
| 36.1% | 0% | 40% | 35% | 35% | 36% | 36% |
| \-2.8% | 0% | \-3% | \-3% | \-2.75% | \-2.8% | \-2.8% |

Each setting emphasizes different relationships in the data.  The goal is not precision—it is interpretability.

## Adaptive precision

Smaller values can be simplified more aggressively without affecting the overall structure of the data.

| original value | `=round_dynamic(A1:A7, -0.5, 0)` |
| :---- | :---- |
| 87,054,321 | 85,000,000 |
| 84,654,321 | 85,000,000 |
| 22,484.49 | 20,000 |
| 2,484.49 | 2,000 |
| \-22,484.72 | \-20,000 |
| 36.1% | 40% |
| \-2.8% | \-3% |

In this example, the largest values are rounded to the nearest half order of magnitude `(0.5)`, while smaller values are rounded more aggressively.

This preserves structure in large numbers while improving overall readability, especially in larger and more complicated datasets.

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

## Quick Examples

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

——————————————————————————————————————————————

## Documentation

* [Design Doc](https://www.google.com/search?q=./docs/design.md) — Algorithm and concepts  
* [Google Sheets README](https://www.google.com/search?q=./js/README.md) — Full Sheets documentation  
* [Python README](https://www.google.com/search?q=./python/README.md) — Full Python documentation

## License

MIT

——————————————————————————————————————————————

## An example of reading a story from data

Data can unconsciously encode information it was not designed to reveal.  
In this invoice, you can read a company's business model, underlying architectural beliefs and transformation goals.

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