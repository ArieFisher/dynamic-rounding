# **Dynamic Rounding**

*Quickly make data more readable.*

Numbers can really get in the way of understanding data.

I spend a lot of time staring at data. The first thing I always do is simplify the numbers, usually by getting rid of most of the detail (e.g., 1,234,567 becomes "about 1 million"). I fiddle and adjust with each value until the story emerges (in spreadsheets, by using mround(), ceiling(), floor(), round(to negative numbers)...)

This tool takes a different approach. It rounds numbers *declaratively* — you describe the precision you want, and the function adapts to each value's magnitude.

Spreadsheets don't have too many declarative features. There's room for more — that's what this experiment is for.

## **Implementations**

| Platform | Location | Install |
| :---- | :---- | :---- |
| Google Sheets | [js/](https://www.google.com/search?q=./js/) | [Copy template](https://docs.google.com/spreadsheets/d/1GdHvYk3dVzJErrGH7yDULW6srM0gaHeYMGMn3k0-GY4) |
| Python | [python/](https://www.google.com/search?q=./python/) | pip install dynamic-rounding |

## **Quick Examples**

### **Google Sheets**

* \=ROUND\_DYNAMIC(87054321) \-\> 85,000,000  
* \=ROUND\_DYNAMIC(A1:A10)   \-\> rounds entire range with set-aware precision

### **Python**

* from dynamic\_rounding import round\_dynamic  
* \# Single value  
* round\_dynamic(87054321) \# \-\> 85,000,000  
* \# Dataset \- larger values get finer precision  
* round\_dynamic(\[4428910, 983321, 42109\]) \# \-\> \[4,500,000, 1,000,000, 40,000\]

### **Python with pandas**

* from dynamic\_rounding.pandas import round\_dynamic\_series  
* \# Rounds entire Series with set-aware precision  
* round\_dynamic\_series(df\['revenue'\])  
* \# Parses formatted strings automatically  
* \# "$1,200" → 1200, "(500)" → \-500

## **Features**

1. **Declarative Rounding:** Specify an offset that gets applied to *each* number's order of magnitude. No need to hand-write formulas for every cell.  
2. **Set-Aware Rounding:** When given a dataset, larger numbers retain more detail while smaller numbers are simplified. This gives the simplified dataset more accuracy (greater precision in the bigger numbers) AND more readability (in everything else).  
3. **Sign-Aware:** Handles negative numbers correctly.  
4. **Robust:** Non-numeric values pass through unchanged. Nulls, zeros, and dates don't crash.  
5. **String Parsing:** Automatically parses $1,200, (500), and other formatted strings.  
6. **Type Preservation (Python):** Returns int when input was int and result is whole.

## **Simplifying Thoughtfully**

Simplifying data can be dangerous.

| Original Value | \=ROUND(A2, \-6) |
| :---- | :---- |
| 7,524,321 | 8,000,000 |
| 7,474,329 | 7,000,000 |
| *difference* | *difference* |
| 49,992 | 1,000,000 |

In this case rounding destroyed the story. Two nearly-identical numbers are now apart by a million.

The built-in rounding function can be too blunt of an instrument. To be sure, this can be solved by applying some manual effort to every single number in the data set (e.g. switching ROUND() to MROUND()...). But in the declarative model, we can ask to round to the nearest half-order of magnitude:

|  | Original Value | \=ROUND(.., \-6) | \=ROUND\_DYNAMIC(B2:B3, 0.5) |
| ----- | :---- | :---- | :---- |
|  | 7,524,321 | 8,000,000 | 7,500,000 |
|  | 7,474,329 | 7,000,000 | 7,500,000 |
|  | *true difference* | *blunt simplification* | *thoughtfully simplifying to the nearest half-order of magnitude* |
| *Difference* | 49,992 | 1,000,000 | 0 |

The message here is that the two values are identical:  50k on a million is effectively zero. 

The number (49,992) was getting in the way of that message.

The changing a single parameter, the user can instantly regenerate the entire data set, and can keep doing so until the story clicks into place for them.  

This parameter is an optional ‘offset’ from the nearest order of magnitude (OoM). 

### **Using custom offsets**

| Formula with optional ‘offset’ parameter | Declarative meaning | Declarative meaning in plain language i.e. against a number of tens of millions, round to the… | 87,054,321 rounds to: |
| :---- | :---- | :---- | :---- |
| `=round_dynamic(A1, 1)` | one OoM coarser | … nearest hundred million | 100,000,000 |
| `=round_dynamic(A1, 0)` | current OoM | … nearest ten million | 90,000,000 |
| `=round_dynamic(A1, -0.05)` | half of current OoM | … nearest five million | 85,000,000 |
| `=round_dynamic(A1, -1)` | one OoM finer | … nearest million | 87,000,000 |
| `=round_dynamic(A1, -1.5)` | half of one OoM finer | … nearest half-million | 87,000,000 |

If this sounds too complicated then don’t bother with the optional parameter described above.  Consider it an ‘Easter egg’.

## **Set-Aware Rounding**

At this point I almost feel bad bringing in another optional parameter.  I’ll say it briefly and urge you not to pay attention.  When you find yourself reaching for this feature, you will find it just where you expected it to be.

By default, this function preserves a little more granularity in the biggest numbers and a little less in the smaller ones

* The ‘biggest’ numbers are rounded to the nearest half OoM (more accurate)  
* The rest to the nearest order of magnitude (more readable)

These 2 offsets are customizable.  But don’t worry, the defaults do a really good job.

# **An example of reading a story from data**

You can tell a lot from a cloud invoice.

Just by reading The following monthly invoice, you can tell a lot about this fictitious company, including: 

* what business it is in (i.e. its primary product)  
* its architectural principles and beliefs  
* it’s transformation goals  
* and the experiments it is running to validate its new approach

The barrier to getting the story from this data is these damned numbers (I used a sample cloud bill downloaded from Kaggle):

| Service Name | Cloud Bill | Order of magnitude |
| :---- | :---- | :---- |
| Cloud CDN | $4,228,910.4100 | millions |
| Cloud Storage | $3,812,105.5929 | millions |
| Cloud Load Balancing | $1,011,204.393 | millions |
| BigQuery | $824,479 | hundreds of thousands |
| Cloud Dataflow | $62,583.3113 | tens of thousands |
| Cloud Dataproc | $43,937.77 | tens of thousands |
| Cloud Pub/Sub | $9,911.21 | thousands |
| Compute Engine | $17.24 | tens |

We can make a few attempt to clean up the data

| Service Name | Cloud Bill | Round the set using custom offsets `=ROUND_DYNAMIC(B2:B9, -0.25, -0.5)` |
| :---- | :---- | :---- |
| Cloud CDN | 4,228,910.41 | 4,250,000 |
| Cloud Storage | 3,812,105.5929 | 3,750,000 |
| Cloud Load Balancing | 1,011,204.393 | 1,000,000 |
| BigQuery | 824,479.000 | 800,000 |
| Cloud Dataflow | 62,583.311 | 65,000 |
| Cloud Dataproc | 43,937.770 | 45,000 |
| Cloud Pub/Sub | 9,911.210 | 10,000 |
| Compute Engine | 17.2410 | 15 |

The default set-aware dynamic rounding was pretty good.  The custom offsets look a little better to me so I went with it.  

Now that the extraneous detail is removed, the story is clear.

### **The story in this data**

This invoice reveals a company that operates a **massive content platform** and is in the middle of a **strategic architectural shift** away from **centralized data platform** towards a data lake that **decomposes its 2 major categories of work** into more appropriate tool for the job \- a **real-time**, event-driven platform, and, a batch analysis tool.

| Service Name | Cloud Bill | Role in the Story |
| ----- | ----- | ----- |
| Cloud CDN | $4,250,000 | the company and product: a massive global web application serving  content (likely Video, Gaming, or Media). |
| Cloud Load Balancing | $3,750,000 | very high traffic volume (supports the serving story) |
| Cloud Storage | $1,000,000 | high storage cost adds detail to the 'serving' story: it points to the serving large files (e.g. video), nudging us away from a ‘shopify’ towards a social media or streaming (e.g. vimeo) type company. |
| BigQuery | $800,000 | Likely for some analytics and all log processing; This cost looks high.  We know this company designs cloud-native architectures (notice no Compute Engine) \-  perhaps it is  decomposing its monolithic data platform into: |
| Cloud Dataflow | $65,000 | 1a. **Real-time**: processing logs as they stream in, and ... |
| Cloud Pub/Sub | $10,000 | 1b. supporting the streaming ingest into Dataflow |
| Cloud Dataproc | $45,000 | 2\. **Batch**: Spark jobs for deep analytics |
| Compute Engine | $15 | Hygiene opportunity: clean up what might be a forgotten administrative instance |

*NB: if you doubt this story, paste the raw data table into ChatGPT and ask it what it thinks.*

**Key Architectural Narratives:** 

*Cloud-native architecture*: With only $20 in Compute Engine, this is a "pure-play" serverless company. They have zero interest in managing infrastructure.

*Streaming over Batch*: The ratio between Dataflow vs. Dataproc spend shows a company that prioritizes immediacy. They aren't waiting for nightly batches; they are processing CDN telemetry in real-time to detect errors, fraud, or performance dips.

*BigQuery Decomposition*: BigQuery is transitioning but its large cost shows it is still the system of record with the team experiments with streaming log ingestion and lower-cost batch processing (while still relying on its preference for managed services).

*Log-Centric Value*: The combined cost of the data pipeline suggests that the logs themselves are the "nerve system" of the business, enabling reactive performance tuning of the $4.25M CDN.

## **Documentation**

* [Design Doc](https://www.google.com/search?q=./docs/design.md) — Algorithm and concepts  
* [Google Sheets README](https://www.google.com/search?q=./js/README.md) — Full Sheets documentation  
* [Python README](https://www.google.com/search?q=./python/README.md) — Full Python documentation

## **License**

MIT  
