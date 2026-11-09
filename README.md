# Make data readable

Data can tell rich stories, but sometimes the numbers get in the way.

This library makes data more readable, helping us see the patterns that allow us to read the stories it contains.


## Implementations

| Platform | Location | Install |
| --- | --- | --- |
| Google Sheets | [js/](./js/) | [Copy template](https://docs.google.com/spreadsheets/d/1GdHvYk3dVzJErrGH7yDULW6srM0gaHeYMGMn3k0-GY4) |
| Chrome Extension | [chrome-extension/](./chrome-extension/) | [Load unpacked](https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked) |
| Python | [python/](./python/) | `pip install dynamic-rounding` |

## Quick Examples

### Platform 1. Google Sheets

This library includes a custom Google Sheets function for easily simplifying data.

- `=ROUND_DYNAMIC(87054321)` → 85,000,000
- `=ROUND_DYNAMIC(A1:A10)` → rounds the whole dataset 

Note: there does not (yet) exist a spreadsheet function to simplify data that (a) can operate on a dataset (b) simplifies declaratively.

The defaults handle most cases, and advanced users can tweak its output to put different ‘lenses’ on the data, to see it in ways that their specific situation calls for.

### Platform 2. Chrome Extension

[1 minute video demo](https://share.descript.com/view/Y76MAoqM06p)

The extension works where you do - in your browser.  It simplifies numbers - *in place* - as you browse, read email, use tools or chat with LLMs.

If you do come across data you want to understand better, instead of you pasting data from a browser into a spreadsheet, the Chrome extension effectively pastes a spreadsheet into your browser.

The intention is to enrich your experience without adding any mental load - you do the same activities but get more out of them.
### Platform 3. Python
#### 3a. Simple python
Data professionals may explore their data with python libraries.

- `from dynamic_rounding import round_dynamic`
- Single value: `round_dynamic(87054321)` → 85,000,000
- Dataset: `round_dynamic([4428910, 983321, 42109])` → \[4,500,000, 1,000,000, 40,000\]

#### 3b. pandas
- `from dynamic_rounding.pandas import round_dynamic_series`
- Entire series:  `round_dynamic_series(df['revenue'])`

# Why make data readable? (an extended example)
Most data I see has one thing in common — it's nearly impossible to understand.

Who knows this the best?  The people who design pricing pages. 

<div align="center" style="line-height: 0;"> <img src="docs/media/image01.png" alt="image" width="800"></div>
<p align="center" style="margin-top: 4px;"><em> Can you tell at a glance which of these options costs 2x another, and 11x times more than the cheapest?</em> </p>

You probably can't, at least not easily, even though the data is there.  What these designers understand is that our working memory is limited.

<div align="center" style="line-height: 0;"> <img src="docs/media/image03.png" alt="image" width="400"></div>
<p align="center" style="margin-top: 4px;"><em> https://pageperson.org/blog/cognitive-load-on-pricing-pages-patterns-that-confuse-buyers/</em> </p>


<p>Cognitive psychologist George Miller found that humans can hold at most 6 or 7 things in our head at once.  
<div align="center" style="line-height: 0;"> <img src="docs/media/image04.png" alt="image" width="400"></div>


So if working memory maxes out at about seven items, **what chance do we have** at understanding this?
<div align="center" style="line-height: 0;"> <img src="docs/media/image06.png" alt="image" width="500"></div>
<p align="center" style="margin-top: 4px;"><em> This table contains over 50 numbers that are <u><b>each</b></u> bigger than 6 or 7 digits.  <br> It is just one of <u><b>127 pages</b></u> of that year's financial statements. </em> </p>

This is good data.  It tells a rich story of Splunk’s past, present, and future. Spend a few seconds looking at it - can you see Splunk's story?

If not, don’t blame yourself. **It’s not you.**  It's an impossible task. 

Let's fix that.

### **Step 1: Simplify the numbers**
This is the same data but with **80% fewer numbers**.  The Chrome extension simplified this inside the SEC.gov website.
<div align="center" style="line-height: 0;"> <img src="docs/media/image07.png" alt="image" width="500"></div>


### **Step 2: Patterns**
Now that we can see the *numbers*, let’s look for *patterns*.

The very first two lines are already revealing.  If you like, look at those 2 lines before you continue.

Here's what I see:
- Splunk has **2 service lines**   
- One grew by **300%**; the other grew less than **50%**   
- The faster-growing service is still the **smaller** of the two
\*\**excluding maintenance, which is anyways typically part of licenses.*

Can you see that?   
<div align="center" style="line-height: 0;"> <img src="docs/media/image08.png" alt="image" width="700"></div>
<br><br>

**A second pattern**: each year Splunk spends \$1.5B to grow revenue by \$0.5B \- \$1B. 
<div align="center" style="line-height: 0;"> <img src="docs/media/image09.png" alt="image" width="700"></div>

### **Step 3: Assemble the story**

Humans are meaning-seeking machines.  Stories emerge - sometimes unconsciouly - to explain what our brains have noticed.

So if these are the patterns we read...
- Revenue transitioning from on-prem to SaaS  
- Cost of sales far exceeding new revenue  

… then these are the stories that emerge:
- **Disruption**: industry-wide disruption by SaaS  
- **Changing customer:** who used to reason about *data centers* but are realizing they only need *good networking* to reach cloud services …   
- **Sales effectiveness**: a scale-up still buying growth as it *struggles to scale* in a contested industry

### Was the the *right* story?
Here is how Splunk’s story unfolded: These results are from 2023.  In 2024 it was acquired at a stunning premium:

* by a leading **networking** company 
* who went all-in on the SaaS division (shutting down the licenses division) …   
* and launched a sales campaign to target its own customers, adding over ***one thousand*** new enterprise customers in the first year to the Splunk division/

That is the story of Splunk, and that story was available to read from the 2023 financial statements without any external tools.

Think about how many things come at you every day.  The ability to see one level deeper, even into some of them, can be game changing.

> As an aside: You may be wondering - why not just ask Claude to read and interpret this data?
> You could, and maybe you should.  But think about it this way: 
> - notice how much story has been pulled out *and the analysis hasn’t even started yet*.  Simplifying the data lets you see the patterns *before* you analyze it (with or without AI).
> - Pasting it into an LLM *replaces* you; this *accelerates* you. Your knowledge and experience are the only way to get differentiated insight.


## Try it yourself


Lets put it to the test - you do this one. 
This is Netflix's first week of trading data. Most of us don't handle data this complex, so lets see if the tool can work here for you, and if so it may be meaningful for your more typical tasks.

### Task 1: Spot the outliers

Take 3-5 seconds to identify the outliers in the ‘volume’ column.

<div align="center" style="line-height: 0;"> <img src="docs/media/image10.png" alt="image" width="600"></div>
<p align="center" style="margin-top: 4px;"><em> https://www.kaggle.com/datasets/kalilurrahman/netflix-stock-data-live-and-latest?select=Netflix_stock_history.csv</em> </p>

Confident in your choice?  Now try it on simplified data. 

<div align="center" style="line-height: 0;"> <img src="docs/media/image11.png" alt="image" width="600"></div>

<br>**Answer**: The outliers are the first and last values.  On its first day after going public, \~1 B shares of Netflix traded.  This went up and down until the 7th day when only 30mm traded.

### Task 2: Spot average trading volume

Excluding the outliers, what was Netflix's average trading volume that week?  Don't use a calculator or spreadsheet.  Take a few seconds before reading on.

<div align="center" style="line-height: 0;"> <img src="docs/media/image12.png" alt="image" width="600"></div>

<br>**Answer**: The average trading volume in the first 7 days (excluding the outliers) was ~85 million.

Look at the original table again. I don't think many of us could *still* see as much with just our eyes and brain. 

This simple tool helps us unlock insights by working with us, amplifying the way we naturally explore and understand data.

## License

MIT
