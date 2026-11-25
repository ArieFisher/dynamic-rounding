---
name: refactor
description: Run a refactor pass over a file, a list of files, or a directory. For each file, a find subagent reports cleanups in two groups, A (no decision needed) and B (decisions for the product manager), and an action subagent makes the Group A cleanups. A review subagent then checks the whole branch, and the run opens a pull request. Use this skill when the user asks for a refactor pass or names this skill.
---

## Agent instruction

* Before the first file, create a branch from main named `refactor/asx-<YYYYMMDD>`.
* If given a list of files, a directory, or a repository, run the two subagents below on the first file, one after the other. When the second one has finished, repeat for the next file on the list.
* Skip `js/round_dynamic.js`.
* Run the find and action subagents as the `refactor` agent type. That type runs them on Opus high and gives them only the tools they use. Run the review subagent on Opus high.
* After each file, reply in chat with one line giving that file's counts for groups A and B. After the last file, add one line with the totals across all files. No preamble and no summary of groups A and B.
* The only exception is where the action subagents made judgement calls: describe those simply, in plain language for a product manager audience.
* After the last file, run the review subagent below on the whole branch.
* After the review subagent returns APPROVE, push the branch and open a pull request. Do not merge it.
* File no issues, write no memory. Retain no records of anything that was not actioned.
* Delete the findings files.
* When finished, report the elapsed time and three token counts summed over every subagent: read (new), read (cache), and written. Take them from the usage recorded in each subagent's transcript, and count each reply once. A subagent's own token total measures the size of its conversation at the end, not the tokens it processed, so do not report it. Give no dollar cost.

## 1. Find subagent

Apply this to the file named in the input. Read that file in full.

Do not edit any files. Write your findings to `docs/private/asx-<YYYYMMDD>-<input file name>.md`, and create no other file.

Report what you find, and leave fixes for a later step. For each finding, say where it is and what it is in one line, and mark it A or B (see Categorize below). When a finding leads into another file, search that file and read only the part the finding needs. To find the tests for the file's code, search the test files for the names the file defines. Read the names and group headings of the tests that match, and read a test's body only when a finding depends on it. Do not read a test file in full.

### Coherent Vocabulary

- Search for: deviations from the vocabulary (`docs/vocabulary.md`) in code, comments, function names, constants, etc. This includes any retired synonym listed in a term's "Not" column.
- Search for: a comment and its code that use different terms for the same thing, e.g. a variable name and the comment describing it.

### Comment Quality

Read every comment in the file.

- Search for: comments on self-documenting code, where the behavior or logic is clear from the code alone.
- Search for: comments that make up for unreadable code, where what the code does, or where its values come from, is hard to understand without the comment. Leave out cases where making the code readable would complicate it or go against one of the architecture principles below.
- Search for: comments, test names, test group headings, and documents that describe behavior, names, or values the code no longer has.
- Search for: a reason written out in full in more than one place. See "Group like concepts into a single location" in `AGENTS.md`.
- Search for: comments longer than they need to be.

### Test Names

- Search for: a test name or test group heading that breaks the test-name rule under "Code style" in `AGENTS.md`.

### Rules Written Later

- Search for: code, comments, test names, and living documents, in the file, its tests, and the documents that describe it, that no longer follow a rule in `AGENTS.md` or `docs/design.md`, or that still use a term the vocabulary has replaced. See "Docs track behavior" in `AGENTS.md`.

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

### Categorize

- Group A: cleanups that need no decision from me
- Group B: decisions for me

A cleanup needs no decision only if all of these hold:

1. Nothing visible changes. This includes capture files, debug rows, behavior when an operation fails, and how code outside the repository calls a function, such as a Sheets formula or a Python script.
2. No vocabulary question. The change adds no new term or name and does not rename a concept.
3. No architecture question. The change does not move state or logic between the view, the controller, and the model, and it does not change which part writes to which.
4. No design question. The change does not depart from a rule in the design document. Correcting a sentence to match the code is allowed.

## 2. Action subagent

* Read the findings file. Address every Group A cleanup, one at a time.
* If, mid-effort, you discover a question you had not anticipated, answer it yourself and continue when the answer is trivial or you have a strong recommendation, meaning one option is clearly better and you can say why in one sentence. Otherwise, revert that change and move on.
* After each cleanup, run the test suites that cover the files you changed. If a suite fails, revert that cleanup and move on.
* For every cleanup, follow the two search rules under "Docs track behavior" in `AGENTS.md`, in the same commit.
* Commit your changes with a "refactor:" message that names the file and a summary of the change. Skip the commit if you changed nothing.
* Return to the main agent the counts for groups A and B, and each judgement call you made, in plain language.

## 3. Review subagent

Use the code-reviewer agent. It has not seen the findings files or the action subagents' reports. Give it the branch, not a summary of the changes.

* Review the branch's full diff against main. Test the claim that every change is a Group A cleanup, as Categorize defines it: look for behavior changes on real page paths, removed guards that a real caller still reaches, changed signatures or return values whose callers were not all updated, and comments, test names, test group headings, or documents that now state something false or that the branch's changes left out of step with a rule under "Docs track behavior" in `AGENTS.md`.
* Run the test suites that cover the changed files.
* Edit no files. Return APPROVE or BLOCK, and each finding with its location, its severity, and whether it is a defect in the branch's own changes.
* A defect in the branch's own changes forces BLOCK. The main agent fixes it or reverts the cleanup that caused it, reruns the suites, and sends the branch back to the same reviewer until it returns APPROVE.
* The main agent fixes a finding that changes no behavior and touches only lines already in the diff. It reports any other finding in chat, in plain language, and acts on none of them.
