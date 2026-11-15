# Refactoring code that an AI coding agent wrote

A case study from four days of work, 12 to 15 November 2026.

**Sources.** The figures come from the findings files, plans, and session notes I kept during the work. The line counts come from GitHub's record of each merged pull request. I did not rerun any trial for this write-up.

## TL;DR

- Code that an AI coding agent writes under written rules still drifts from those rules. Each change followed the rules when it was made. The drift appears only when several changes are read together. An audit of six files found 208 problems.
- The agent looked only for the kinds of problem named in the prompt. A bare "refactor this file" request found about 13 problems in one file, none of them about vocabulary. A prompt that named seven kinds of problem found about 65.
- The output varies from run to run. Large problems appeared in every run. Subtler ones appeared in about half. One run is a sample.
- Judging took more of my attention than finding. In the two columns about code structure, 40 to 48 percent of the findings were gone, wrong, or not worth doing once an agent checked them against the current code.
- The line between "the agent does it" and "I decide" needs a written test. Under the agent's first test, ten changes that needed my decision were marked as needing none.
- The audit also found three defects that a user could see. Nobody had reported them.
- Merging duplicated code can make the code larger. The first batch of merges added 30 lines of code. Cutting the comments that batch added left the code 27 lines smaller than before.

## The setting

I am a product manager, and I do not write code. An AI coding agent (Claude Code) wrote almost all of the code for a browser extension that rounds the numbers in web tables so they are easier to read, for example 87,054,321 to 85,000,000.

The agent works under written rules:

- a design document with architecture principles, for example "parts communicate through events; they do not reach into each other's internals";
- a vocabulary with one term per concept and a list of retired synonyms for each term;
- a comment rule: a comment holds only what the code cannot show;
- a review rule: a second agent reviews each change before I merge it.

A **refactor** is a change to how code is written that leaves what it does unchanged. A **pull request** is one proposed change, which I review and merge. The **test suite** is about 4,450 automated tests that run on every pull request.

Every change had passed these rules when it was made. My question: what does a refactor find in code built this way, and how does a person who does not read code run one?

I worked in four stages: finding, output of findings, judging, and acting.

## Stage 1: Finding

### The prompt sets the scope

I first compared two requests on the same file, about 460 lines long, three runs each:

| Request | Findings per run | Vocabulary findings |
|---|---|---|
| "Refactor this file" | about 13 | none |
| My prompt listing seven kinds of problem | about 65 (mean of three) | yes |

The agent looked only for the kinds of problem named in the request. The prompt that named seven kinds produced five times as many findings.

I then wrapped my prompt in a two-step tool: one step to find, and one step to sort the findings into pull requests. Results of the trial:

- The find step returned what the prompt returned alone. The wrapper added nothing to finding.
- Three runs of the sort step on the same input gave 60, 60, and 75 findings, 13, 15, and 12 proposed pull requests, and net line changes of −142, −155, and −4. The numbers looked measured. They were guesses.
- The sort step labelled items "no behavior change, the test suite proves it". It had run no tests.

I discarded the wrapper. Before keeping structure added around a prompt, I now test whether it changes the result.

### Prompt language

I rewrote the prompt. The full text is in [Appendix A](#appendix-a-the-find-prompt), and the original is in [Appendix B](#appendix-b-the-original-prompt). An excerpt:

> Report what you find, and leave fixes for a later step. For each finding, say where it is and what it is in one line. Follow a finding into other files when it leads there. When a section has no findings, write "none found".
>
> ### Comment Quality
>
> - Search for: comments that describe behavior the code no longer has.
>
> ### Technical Debt
>
> - **Publisher and subscriber.** Parts communicate through events on the event bus. They do not reach into each other's internals.

What I changed, and what the trials showed:

- **Kinds of problem became searches.** Each kind starts with "Search for:" and one concrete target.
- **Labels became rules.** The original named principles ("decoupled, abstracted, MVC, publisher/subscriber, etc."). The rewrite states each principle as a rule that a piece of code can break. I did not test this change on its own.
- **Finding and fixing are separate steps.** In most runs, the agent proposed fixes anyway.
- **An empty section says "none found".** Without it, an empty section could mean "checked, nothing there" or "skipped".
- **One line per finding, with its location.** With one line each, the output stayed short enough to sort.
- **A line I dropped.** One version also told the agent to run the vocabulary's search patterns first. Results were the same with and without it, because the trial file held no retired synonyms. One file holds only some kinds of problem, so the other kinds go untested in a one-file trial.

### The output varies from run to run

I ran the prompt 18 times on one file: two prompt versions, three model settings, three runs each. The model settings were the smaller model (Claude Sonnet) at high reasoning effort, and the larger model (Claude Opus) at medium and high effort. Reasoning effort is a setting for how long the model works through a step.

- Large findings appeared in all 18 runs.
- Subtler findings appeared in about half.
- The larger model found the subtler ones far more often than the smaller one.
- Medium against high effort was uneven, on too few runs to tell.

One run is a sample. A subtle problem missing from one run's output may appear in another's. I settled on one agent per file, one run, the larger model at medium effort, with repeat runs where subtler findings matter.

### The audit

Six agents ran the prompt, one per file, on six of the extension's core files. They returned 208 findings, from 18 to 58 per file.

## Stage 2: Output of findings

Each agent wrote one findings file, with one section per kind of problem. Each finding gave its location and one line, and the file marked which claims the agent had checked and which were estimates. One finding, as written:

> **Line 276 (parameter `mag`).** It abbreviates "max magnitude", and the field it writes is `maxMagnitude`.

I made two choices about the rest of the work.

**One kind of problem at a time, across all files.** I arranged the findings as a table: kinds of problem in rows, files in columns. Then I worked one row at a time across all six files, not one file at a time. Renaming a term means editing every file that uses it. Six agents renaming in six files would have edited the same lines.

**Findings go stale.** After each merge, the code under the remaining findings had changed. Before work began on each of the last three rows, an agent rechecked every finding in it against the current code. By then, 2 of the 35 code-path findings and 8 of the 46 technical-debt findings were gone.

## Stage 3: Judging

### Sorting

I sorted each finding by who acts on it. A **code path** is one route through the code for one job; unifying code paths means merging two routes that do the same job. **Technical debt** is code more complicated than its job needs.

| Kind of problem | Found | Gone, wrong, or not worth doing | Does not require my input | Requires my input: recommended | Requires my input: question |
|---|---|---|---|---|---|
| Vocabulary | 54 | 6 | 41 | 0 | 7 |
| Comment quality | 74 | 6 deferred | 68 | 0 | 0 |
| Unify code paths | 35 | 14 | 17 | 4 | 0 |
| Technical debt | 46 | 22 | 12 | 12 | 0 |

Notes on the table:

- The comment row needed one choice from me for the whole row: one pull request for all comment fixes. The six deferred items needed a code change, not a comment change.
- In the vocabulary row, the agent listed decisions without recommendations. In the two later rows, every decision carried a recommendation. I chose differently from the recommendation in 2 of 14 decisions.
- The rows sum to 209, not 208. The counts were taken at different times.

### Recheck every finding

Some findings were wrong:

- One finding held that two checks repeated each other. They tested different things.
- During the acting stage, the agent reported a suspected defect: a retry with no limit. A closer read found the claim wrong. I had the agent delete a misleading sentence in the comment on that limit.
- While sorting the vocabulary findings, the agent stated that the vocabulary rule covers only prose. That was false: the rule covers code names too. The agent retracted the claim, and I changed the rule's wording so that the next reader does not make the same mistake.

### Label each claim

The discarded wrapper had stated guesses as facts. From then on, every plan marked each claim as checked, with the method, or as an estimate. For example, the technical-debt plan states that three agents read every finding against the current code, ran the test suite, and tried several edits on a scratch copy. It also states that nothing was tried in Chrome and that every size figure is an estimate.

### A written test for "no decision"

In its first technical-debt plan, the agent listed 22 cleanups as needing no decision from me. Its test was "nothing a user sees changes". I rejected that test, and 10 of the 22 moved to my list. Changes that pass "nothing a user sees" and still need a person:

- removing a function that no code calls, when a rule protects function signatures;
- removing a check that matters only on older browser versions;
- moving logic from one architectural part to another;
- changing what the bug-report file records.

The replacement test has six parts ([Appendix C](#appendix-c-the-test-for-no-decision)). A cleanup goes ahead without me only when all six hold.

### The audit is also a defect hunt

Three findings filed as technical debt or duplicated code turned out to be defects a user could see:

1. Pressing Enter on a table's on/off control switched the table twice, so it ended where it started.
2. The first right-click highlight on a page showed nothing.
3. With the sidebar open in two windows, a page reload in one window could close the sidebar in the other.

Nobody had reported any of the three. The agent found each by reading the code. None was reproduced in a browser before the fix. After the fix, I tested the third by hand, and all four steps passed.

## Stage 4: Acting

### The order and the rules

I acted on one row at a time: vocabulary, then comments, then code paths, then technical debt. I did not try another order.

The rules for each change:

- A change that leaves behavior alone goes in its own pull request, apart from any behavior change. The existing test suite then checks it.
- A second agent reviews every pull request before I merge it.
- A defect fix comes with a test that fails without the fix.
- A behavior change gets a manual check on a test page.

### What changed

Line counts per stage. "Code" includes code comments. Test lines are counted apart.

| Stage | Pull requests | Code lines | Test lines |
|---|---|---|---|
| Vocabulary | 4 | +316 / −348 (−32) | +1,187 / −1,195 (−8) |
| Comments | 1 | +200 / −430 (−230) | none |
| Code paths, first batch | 6 | +271 / −241 (+30) | +277 / −194 (+83) |
| Code paths, comment cut | 2 | +18 / −75 (−57) | +6 / −20 (−14) |
| Technical debt | 6 | +155 / −215 (−60) | +333 / −362 (−29) |

[Appendix D](#appendix-d-pull-requests) lists the pull requests.

### Merging duplicates can grow the code

The point of merging duplicated code is less code. The first batch of code-path merges added 30 lines. I did not accept the agent's first explanation of the growth. When the agent counted code lines and comment lines apart, it found that the batch had added comments to explain the new shared functions. Cutting those comments left the code 27 lines smaller than before the batch.

The rule I now apply: before a consolidation ships, count code lines and comment lines apart, and confirm that the code shrinks.

### Decisions keep arriving

New questions came up during the acting stage. I approved one rename that came out of a question about a part's name. I declined two proposals: comments that record why a finding was left alone, and one more step moved onto events. Plan for a steady flow of small decisions during the acting stage, not only at the judging stage.

### Manual checks fall behind

I merged on the strength of the test suite and the review. At the time of writing, the manual checks in 13 of the merged pull requests have not been run (count from my session notes). The automated tests cover changes that leave behavior alone. A behavior change still needs a person to look at the page.

## Limits

- I ran the audit once per file. Given the run-to-run variation, the 208 findings are a sample. A second run would likely find more subtle problems (estimate).
- The trials used one file of about 460 lines. I have not tested repeat runs on larger files.
- I did not measure the cost of the agent runs.

---

## Appendix A: the find prompt

```markdown
## 1. Find

Apply this to the file named in the input. Read that file in full.

Do not edit any files. Write your findings to `docs/private/findings-<input file name>.md`, and create no other file.

Report what you find, and leave fixes for a later step. For each finding, say where it is and what it is in one line. Follow a finding into other files when it leads there. When a section has no findings, write "none found".

### Coherent Vocabulary

- Search for: deviations from the vocabulary (`docs/vocabulary.md`) in code, comments, function names, constants, etc. This includes any retired synonym listed in a term's "Not" column.
- Search for: a comment and its code that use different terms for the same thing, e.g. a variable name and the comment describing it.

### Comment Quality

Read every comment in the file.

- Search for: comments on self-documenting code, where the behavior or logic is clear from the code alone.
- Search for: comments that make up for unreadable code, where what the code does, or where its values come from, is hard to understand without the comment. Leave out cases where making the code readable would complicate it or go against one of the architecture principles below.
- Search for: comments that describe behavior the code no longer has.
- Search for: comments longer than they need to be.

### Unify Code Paths for Parity by Construction

- Search for: places where code or logic has been branched or duplicated that can be harmonized. List where the versions are, and name the job they share.

### Technical Debt

The code grew organically, so it may be more complicated than it needs to be.

- Search for: complex logic. Rules with more cases, conditions, or special cases than the behavior needs, including conditions that never change the result.
- Search for: complex code. Code that is more complicated than the logic it implements: deep nesting, long functions, or roundabout steps.
- Search for: code that goes against these architecture principles:
  - **Decoupled layers.** The core logic (rounding, parsing, classification) does not read the page and does not call Chrome. Only the code that connects the core logic to the page and to Chrome reads the page or calls Chrome.
  - **One model for state.** Each piece of shared state lives in the application model and changes in one place. Views draw the state, and the controller connects the two.
  - **Publisher and subscriber.** Parts communicate through events on the event bus. They do not reach into each other's internals.
  - **One interface over table kinds.** Code outside the table adapters works through the adapters' shared methods. It does not check which table kind it holds, and it does not call an adapter's internal methods.
```

## Appendix B: the original prompt

```markdown
Analyze the input file for:

1. places where code has been branched (or duplicated) that can be harmonized.

2. code that requires comments to explain its logic. If the comment is necessary, then consider changing the code and removing the comment (unless that would complicate the code).
2b. If the behaviour or logic can be read clearly from the code, then the comment is unnecessary and should be deleted.

3. deviations from the vocabulary (docs/vocabulary.md)

4. coherence between the comment and its code: search for the comment attached to all code and vice versa for vocabulary disagreements between the code and its comment (e.g. variable names and the comment describing it)

5. simplicity: Because the code has grown organically, it may be more complicated than necessary. Look for opportunities to refactor that simplify the logic, code, or number of lines of code.

6. architectural coherence. look for areas where the logic does not implement the architecture guidelines, namely decoupled, abstracted, MVC, publisher/subscriber, etc...

7. Complexity of any kind. We want the code to be as simple as it can be - no more and no less.
```

## Appendix C: the test for "no decision"

A cleanup needs no decision only if all of these hold:

1. **Nothing visible changes.** This covers what a user sees on a page, the bug-report file, the extension's debug log, behavior on older browser versions, and behavior when an operation fails.
2. **No vocabulary question.** The change adds no new term or name and renames no concept.
3. **No architecture question.** The change moves no state or logic between architectural parts.
4. **No design question.** The change departs from no rule in the design document. Correcting a sentence to match the code passes.
5. **No exported function loses an input or an output.**
6. **The code shrinks, or every addition serves a stated requirement.**

## Appendix D: pull requests

| Stage | Pull requests |
|---|---|
| Vocabulary | #643, #644, #645, #648 |
| Comments | #650 |
| Code paths, first batch | #654, #655, #656, #657, #658, #664 |
| Code paths, comment cut | #666, #668 |
| Technical debt | #670, #671, #672, #676, #677, #678 |
| Rename raised during acting | #679 |

Each file is counted as a test file, a document, or code, by its path. Document lines are left out of the table in Stage 4. #644 changed only a document.

## Appendix E: trial figures

**Prompt against bare request** (one file, three runs each):

| Arm | Findings per run |
|---|---|
| Two-step wrapper, find step | 69, 59, 69 |
| Prompt alone | mean about 65 |
| "Refactor this file" | about 13, none about vocabulary |

**Sort step of the wrapper** (three runs on the same findings):

| Run | Findings | Proposed pull requests | Predicted net lines |
|---|---|---|---|
| 1 | 60 | 13 | −142 |
| 2 | 60 | 15 | −155 |
| 3 | 75 | 12 | −4 |

**Audit findings per file:** 58, 42, 37, 27, 26, 18.
