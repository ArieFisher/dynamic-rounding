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
- Search for: comments that describe behavior, names, or values the code no longer has.
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
