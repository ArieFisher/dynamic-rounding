---
name: refactor
description: Run a refactor pass over a file, a list of files, or a directory. For each file, a find subagent sorts cleanups into Group A (no decision needed) and Group B (decisions for the product manager), and an action subagent makes the Group A cleanups. A review subagent then checks the branch, and the run opens a pull request. Use when the user asks for a refactor pass or names this skill.
---

## Main agent

Run to the end without stopping to ask questions. File an issue only for a defect on main, as section 3 says. Write no memory, and keep no record of anything not done: a Group B finding reaches the product manager only through chat, and is lost on purpose when no one reads it, because a later pass may resolve it. In chat, write no preamble and no summary of the groups, except the Group B lines in step 2.

1. When the input mixes test pieces and other files, report it in chat and stop. Otherwise, create a branch from the latest main named `refactor/asx-<YYYYMMDD>`. Use the run's start date here and in every findings file name. A pass over test pieces is a run in which every input file is a test piece.
   1. In a pass over test pieces, create `docs/private/` if it is missing, then start `measure` on the branch's start commit in the background, with the result file at `docs/private/asx-<YYYYMMDD>-measure.json`. "Measuring the extension tests" in `CONTRIBUTING.md` describes each mode and its run time.
   2. In a pass over test pieces, no cleanup changes a product file: `prove` exits 1 with "measure again" on any product change. `EXTENSION_SUITE` in `scripts/planted-bugs.js` defines product files: every file under `chrome-extension/` outside the runner and its tests folder, documents and the manifest included. A correction that the "Docs track behavior" search rules lead to in `chrome-extension/README.md` is a product change too.
2. For each file in the input, one at a time, skipping `js/round_dynamic.js`, run the find subagent and then the action subagent. Use the `refactor` agent type for both, and give each its section name, the input file, and the findings file's path. For a test piece, also give the find subagent the sort output's path.
   1. Before the find subagent for the first test piece, wait for `measure` to exit, then run `sort` on the result file and write its output to `docs/private/asx-<YYYYMMDD>-sort.txt`. If either mode exits with any code but 0, report its output in chat and stop.
   2. After the find subagent finishes, reply in chat with the file's Group B lines, and file an issue for each defect on main it found, as section 3 says.
   3. After the action subagent finishes, reply in chat with one line giving the file's Group A and Group B counts. Add any judgement calls the action subagent made, in plain language for a product manager.
3. After the last file, reply with one line of totals.
4. In a pass over test pieces, run `prove` with the result file on the branch in the background, and wait for it to exit. If it exits with any code but 0 and its output lists no lost planted bug, report the output in chat and stop. Run the review subagent on the whole branch, and act on its findings as section 3 says.
5. Once it returns APPROVE, push the branch and open a pull request. Do not merge it.
6. Delete the findings files, the result file, and the sort output.
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

### Test pieces

For a test piece, read its lists in the sort output.

- An assertion that repeats others is a Group A finding: drop it. Keep it when its name, a comment, or its test group heading points to a past bug or issue, unless a kept assertion checks the exact same input.
- Tests that the case table rule under "Code style" in `AGENTS.md` covers are a Group A finding: merge them into a case table.
- An assertion that catches nothing is a defect on main: mark it so in place of A or B. An assertion that checks code text, docs, or the manifest is no finding: the planted bug script plants bugs only in product code, so such an assertion catches nothing by design.

### Categorize

A cleanup is Group A only if all of these hold. Otherwise it is Group B, a decision for the product manager.

1. Nothing visible changes. This includes capture files, debug rows, behavior when an operation fails, and how code outside the repo calls a function, such as a Sheets formula or a Python script.
2. No vocabulary question: no new term or name, and no renamed concept.
3. No architecture question: no state or logic moves between the view, the controller, and the model, and no change to which part writes to which.
4. No design question: nothing departs from a rule in `docs/design.md`. Fixing a sentence to match the code is allowed.

## 2. Action subagent

- Make each Group A cleanup in the findings file, one at a time.
- If a cleanup raises a question you did not expect, answer it yourself when the answer is trivial or one option is clearly better for a reason you can give in one sentence. Otherwise, revert that cleanup.
- After each cleanup, run the test suites that cover the changed files. If one fails, revert the cleanup.
- For every cleanup, also follow the two search rules under "Docs track behavior" in `AGENTS.md`.
- On a test piece, revert a cleanup that would change a product file (see step 1.2 of the main agent), and report the revert as a judgement call.
- If anything changed, make one `refactor:` commit for the file that names the file and sums up the changes.
- Return the Group A and Group B counts and each judgement call you made, in plain language.

## 3. Review subagent

Use the `code-reviewer` agent type on Opus at high effort. Give it this section, the Categorize rules, the branch name, and, when the main agent ran `prove`, its exit code and output, and nothing else. Tell it not to read `docs/private/`.

- Review the branch's full diff against main, and test the claim that every change is Group A. Look for:
  - behavior changes on real page paths
  - removed guards that a real caller still reaches
  - changed signatures or return values whose callers were not all updated
  - comments, test names, test group headings, or docs that are now false, or that break a rule under "Docs track behavior" in `AGENTS.md`
- Run the test suites that cover the changed files.
- When the `prove` exit code is 1, report each lost planted bug in its output as a defect in the branch's own changes, with the assertions printed under it.
- Edit no files. Return APPROVE or BLOCK, and each finding with its location, its severity, and its kind: a defect in the branch's own changes, a defect on main (wrong behavior a user can hit today, or an assertion that catches nothing), Group A, or Group B. A defect in the branch's own changes forces BLOCK.

The main agent then:

- Fixes each defect in the branch's own changes or reverts the cleanup that caused it. For a lost planted bug, it reverts the cleanup that removed or changed the assertions printed under it.
- Makes every Group A finding, in any file, except a product file in a pass over test pieces (see step 1.2); it reports that finding in chat instead.
- Files a `[follow-up]` issue for each defect on main, as bucket 3 of "Review findings" in `AGENTS.md` says.
- Reports each Group B finding in chat, in plain language, and acts on none of them.
- After any fix, reruns the suites and, in a pass over test pieces, `prove` as step 4 says, then sends the branch back to the same reviewer with the new `prove` output. The review runs at most three rounds, because each round of fixes outside the diff can surface new findings. After the third round, it reverts every cleanup that still has a defect and reports the Group A findings it did not make in chat. In a pass over test pieces, it then reruns `prove`, and on any exit code but 0 it reports the output in chat and stops.