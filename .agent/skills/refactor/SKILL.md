---
name: refactor
description: Run a refactor pass over a file, a list of files, or a directory. For each file, a find subagent sorts cleanups into Group A (no decision needed) and Group B (decisions for the product manager), and an action subagent makes the Group A cleanups. A review subagent then checks the branch, and the run opens a pull request. Use when the user asks for a refactor pass or names this skill.
---

## Main agent

Run to the end without stopping to ask questions. File an issue only for a defect on main, as section 3 says. Write no memory, and keep no record of anything not done: a Group B finding reaches the product manager only through chat, and is lost on purpose when no one reads it, because a later pass may resolve it. In chat, write no preamble and no summary of the groups, except the Group B lines in step 2.

1. Create a branch from the latest main named `refactor/asx-<YYYYMMDD>`. Use the run's start date here and in every findings file name.
2. For each file in the input, one at a time, skipping `js/round_dynamic.js`, run the find subagent and then the action subagent. Use the `refactor` agent type for both, and give each its section name, the input file, and the findings file's path.
   1. After the find subagent finishes, reply in chat with the file's Group B lines.
   2. After the action subagent finishes, reply in chat with one line giving the file's Group A and Group B counts. Add any judgement calls the action subagent made, in plain language for a product manager.
3. After the last file, reply with one line of totals.
4. Run the review subagent on the whole branch, and act on its findings as section 3 says.
5. Once it returns APPROVE, push the branch and open a pull request.
6. Delete the findings files.
7. Report the elapsed time and three token counts summed over every subagent: read (new), read (cache), and written. Take them from the usage in each subagent's transcript, counting each reply once. Do not report a subagent's own token total, which counts conversation size, not tokens processed. Give no dollar cost.

## 1. Find subagent

Read the input file in full. Edit no files. Write findings to `docs/private/asx-<YYYYMMDD>-<input file name>.md`, and create no other file.

Give each finding one line: where it is, what it is, and A or B (see Categorize). When a finding leads to another file, read only the part of that file you need. To find the file's tests, search the test files for names the file defines. Read only the matching test names and group headings, plus a test body when a finding depends on it.

### Vocabulary and Rules

Search the file, its tests, and the docs that describe it for:

- Terms that differ from the vocabulary (`docs/vocabulary.md`), including old terms in a term's "Not" column.
- A comment and its code that use different words for the same thing.
- Code, comments, test names, and living documents that break a rule in `AGENTS.md` or `docs/design.md`. See "Docs track behavior" in `AGENTS.md`.
- Test names or group headings that break the test-name rule under "Code style" in `AGENTS.md`.

### Comments

Read every comment in the file, and search for:

- Comments that repeat the code.
- Comments that explain unclear code or values with no clear source. Skip cases where clearer code would be more complex or break an architecture principle below.
- Comments, test names, test group headings, and docs that no longer match the code.
- The same reason written in full in more than one place. See "Group like concepts into a single location" in `AGENTS.md`.
- Comments longer than needed.

### Technical Debt

Search for:

- Repeated or split code that can be merged, including functions more than 80% alike and repeated type definitions.
- Conditions that never change the result, or that cover more cases than needed.
- Code more complex than its job: deep nesting, long functions, or extra steps.
- Wrapper functions and re-exports that add nothing.

### Architecture

Search for code that breaks these principles:

- **Separate layers.** Core logic (rounding, parsing, classification) never reads the page or calls Chrome. Only the code that links core logic to the page and Chrome does that.
- **One model for state.** Shared state lives in the app model and changes in one place. Views draw it, and the controller links them.
- **Events between parts.** Parts talk through events on the event bus. They never reach into each other's insides.
- **One interface for all table kinds.** Code outside the table adapters uses only the adapters' shared methods. It never checks the table kind or calls an adapter's private methods.

### Categorize

A cleanup is Group A only if all of these hold. Otherwise it is Group B, a decision for the product manager.

1. Nothing visible changes. This includes capture files, debug rows, behavior when an operation fails, and how code outside the repo calls a function, such as a Sheets formula or a Python script.
2. No architecture question: no state or logic moves between the view, the controller, and the model, and no change to which part writes to which.
3. No design question: nothing departs from a rule in `docs/design.md`. Fixing a sentence to match the code is allowed.

## 2. Action subagent

- Make each Group A cleanup in the findings file, one at a time.
- If a cleanup raises a question you did not expect, answer it yourself when the answer is trivial or one option is clearly better for a reason you can give in one sentence. Otherwise, revert that cleanup.
- After each cleanup, run the test suites that cover the changed files. If one fails, revert the cleanup.
- For every cleanup, also follow the two search rules under "Docs track behavior" in `AGENTS.md`.
- If anything changed, make one `refactor:` commit for the file that names the file and sums up the changes.
- Return the Group A and Group B counts and each judgement call you made, in plain language.

## 3. Review subagent

Use the `code-reviewer` agent type on Opus at high effort. Give it this section, the Categorize rules, and the branch name, and nothing else. Tell it not to read `docs/private/`.

- Review the branch's full diff against main, and test the claim that every change is Group A. Look for:
  - behavior changes on real page paths
  - removed guards that a real caller still reaches
  - changed signatures or return values whose callers were not all updated
  - comments, test names, test group headings, or docs that are now false, or that break a rule under "Docs track behavior" in `AGENTS.md`
- Run the test suites that cover the changed files.
- Edit no files. Return APPROVE or BLOCK, and each finding with its location, its severity, and its kind: a defect in the branch's own changes, a defect on main (wrong behavior a user can hit today), Group A, or Group B. A defect in the branch's own changes forces BLOCK.

The main agent then:

- Fixes each defect in the branch's own changes or reverts the cleanup that caused it.
- Makes every Group A finding, in any file.
- Files a `[follow-up]` issue for each defect on main, as bucket 3 of "Review findings" in `AGENTS.md` says.
- Reports each Group B finding in chat, in plain language, and acts on none of them.
- After any fix, reruns the suites and sends the branch back to the same reviewer. The review runs at most three rounds, because each round of fixes outside the diff can surface new findings. After the third round, it reverts every cleanup that still has a defect and reports the Group A findings it did not make in chat.