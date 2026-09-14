# The extension stops tracking whether the sidebar is open

- **Date:** 2026-09-14
- **Status:** approved design, implementation pending
- **Opens:** #328 (one settings record cannot describe two simplified tables)
- **Closes on landing:** #241
- **Kind:** historical record. This document states the design as approved; the living docs track the system as built.

## Decision

No part of the extension keeps a copy of whether the sidebar is open. A pillbox press means one thing, always. Chrome's own calls open and close the sidebar. One state-change topic carries the active table.

Three parts, each landing on its own. Part one removes a user-visible defect. Parts two and three stop it returning under a different cause.

## The defect

Each page holds its own answer to whether the sidebar is open. Only the service worker can correct that answer, and it needs the tab number to deliver the correction. That number is lost two ways: Chrome empties the service worker's variables after an idle spell, and an ordinary sidebar close clears the number without telling the page. Four events could still trigger the correction — a tab reloading, a tab closing, the user switching tabs, a page unloading — and all four begin by comparing against the number that is gone, so none of them recognizes its own trigger.

With the answer wrong, a pillbox press on a table that is not the active one takes the rebind path instead of on and off. The user believes the pillbox is an on/off control, and it has silently become a control that moves the sidebar to a table. Where the settings record's on/off value was left off, such a press changes no numbers at all and a second press works, so the control reads as intermittent.

The only recovery today is a page reload.

## Current state

**Three press paths.** A press takes one of three: the sidebar is open and the pressed table is not the active one, so the pressed table becomes active and the settings record is applied to it; the pressed table is already the active one, so the record's on/off value flips with its direction read from the screen; neither, so a plain simplify with the shipped defaults, or a form flip back to the originals that keeps the markers and the stored originals in place.

Only the first path reads whether the sidebar is open, and it is the only reader anywhere in the extension.

**Two topics for one fact.** A right-click activating a table sends one cross-context topic, and the sidebar flashes. A press moving the sidebar to a different table sends another, and the sidebar clears a locked table's notice and re-reads. Both state that the active table changed, both are written by hand inside a gesture handler, and the application model already publishes that same change on a state-change topic with no subscribers.

**The service worker holds state.** It keeps the tab number the sidebar was opened for, and closes the sidebar by sending a topic the sidebar page acts on by closing itself. Reaching the sidebar needs no tab number, because that send is a broadcast to the extension's own pages. The number is a test, not an address: three of the four triggers fire for every tab, so without it the service worker cannot tell the sidebar's tab from any other.

## Design

### Part one: one meaning for a pillbox press

A press makes the pressed table active and flips its form from what the screen shows, writing the settings record. The record's change drives the apply. The three paths become one, and the read of whether the sidebar is open has no caller left.

The press acts **through the settings record**, never at the table directly. Two visible behaviors follow from that single choice, and both were decided with it: turning on uses the record's current values rather than the shipped defaults, and turning off resets the table rather than leaving its markers and stored originals in place.

Three reasons for that choice. The pillbox, the sidebar's switch, and the right-click menu then all write the record and let one apply path run, which is one mechanism where there were two. A capture states the settings record, so a press that bypassed the record would make a capture state values that did not produce the table on screen. And the form flip back to simplified currently re-applies each table's last-used options rather than the record's, so a sidebar change made between an off press and an on press is presently ignored; writing through the record removes that path.

Retiring with this part: the page's copy of the sidebar's open value, the model field behind it, its state-change topic, and the close topic's leg to the page.

### Part two: Chrome opens and closes the sidebar

The service worker calls Chrome's close, addressed by tab, in place of sending a topic the sidebar acts on. The call is documented as a no-op when nothing is open for that tab, so the service worker closes the tab an event is about without remembering which tab the sidebar belongs to.

The service worker learns about an ordinary close from Chrome's close event, which carries the tab, in place of the sidebar reporting its own unload.

Retiring with this part: the close topic, the sidebar's self-close handler, the sidebar's unload topic, and the service worker's tab number as a remembered fact. The service worker still needs a tab to open the sidebar and to aim the right-click topic, and both arrive with the menu event rather than from memory.

### Part three: one state-change topic for the active table

One topic replaces the two, published because the application model's active-table value changed and not because a particular gesture ran. The state-change topic that has no subscribers today gains one, and the two hand-written cross-context topics become one.

Both of the model's unsubscribed state-change topics end up resolved, by opposite routes: the active-table one gains its subscriber, and the sidebar-open one retires with the field behind it.

## Platform findings

Recorded once. Read 2026-09-14 from Chrome's extension side-panel reference.

| Capability | Since | Detail |
| --- | --- | --- |
| Close call | Chrome 141 | Takes a tab or a window, at least one of the two. Documented as a no-op when the sidebar is already closed. |
| Close event | Chrome 142 | Carries the path, the window, and, where the sidebar was tab-specific, the tab. |
| Open call | Chrome 116 | A tab opens a sidebar for that tab alone. A window opens one for every tab in that window. |

Chrome stable stands between 152 and 154 this month, so both additions are roughly a year old. The manifest declares no minimum Chrome version today; part two adds one at 142.

Two things the reference does not state, and this design therefore does not assume: whether two browser windows can show the extension's sidebar at the same time, and whether Chrome hides a tab-specific sidebar by itself when the user switches tabs.

## The open question

Switching tabs. Chrome's event carries the tab switched to, never the tab left, so closing the sidebar the user walked away from needs either the window form of the close call or one remembered tab. The reference implies a tab-specific sidebar is already hidden on a switch without stating it, and that answer decides whether the service worker ends up holding nothing at all.

A hand test settles it. Part two waits on the test; part one does not.

## Consequences beyond the defect

1. A press on a table that is not the active one applies the settings record's current values rather than the shipped defaults. The two are identical until a sidebar session changes them.
2. The sidebar reacts in one case where it did not. One topic means one reaction, so a right-click also triggers a re-read and a press also flashes the sidebar.
3. The settings record describes one table. Making every press write it makes the mismatch with a table left simplified elsewhere on the page reachable from any press rather than from some. Filed as #328, and not introduced here.
4. The minimum Chrome version rises to 142 and has to be declared in the manifest.
5. The approved messaging design shrinks. Eighteen cross-context topics become fifteen, the route that reaches both the extension's pages and a tab loses its only topic, and the page-unload topic becomes a candidate for retirement once the platform event covering a tab navigating away is confirmed.

## What does not change

- Simplification itself: the classification ladder, the offsets, the dataset, and the magnitude freeze.
- Locked tables. A locked pillbox reports nothing on a press, so the wrong-direction flip in #277 keeps its single entry point through the right-click menu, neither fixed nor widened here.
- The magnitude re-freeze across a form round trip (#257). Both the present form flip and the new reset re-walk the table on the way back to simplified, so this change leaves that finding where it is.
- Nothing persists. The settings record still starts as the shipped defaults on every page load and dies with the page.

## Rejected alternatives

- **Make the tab number survive a service-worker restart.** Fixes one of the two loss paths. An ordinary close still tells the page nothing, so a second fix would follow, and the page would still hold a copy that other causes can spoil.
- **Ask instead of remember.** Keep the press paths and have the page ask at the moment of the press, which preserves today's behavior exactly. Costs an asynchronous press, and widens the approved messaging design's route rule to allow a request aimed at the extension's pages, where two contexts receive it and only one may answer.
- **Keep the form flip on the way off.** Saves one table walk while the originals show, but leaves the settings record saying off while the table keeps its simplified bookkeeping, and re-applies each table's last-used options rather than the record's.

## Testing

Additions to the extension suite, with Chrome interfaces stubbed as the existing suite stubs them.

- One press path: a press on a table that is not the active one makes it active and flips its form, with no read of any sidebar value.
- The flip direction comes from the screen, so two presses return a table to where it started.
- A press writes the settings record, and the record's change is what applies to the table.
- A press turning simplification on uses the record's current values, not the shipped defaults.
- A locked pillbox still reports nothing on a press.
- The close call is invoked with the tab of the event that triggered it, and nothing is sent to the page.
- The close event updates the service worker without the sidebar sending an unload topic.
- One state-change topic carries the active table, from both a right-click and a press.
- No code reads a stored sidebar-open value: the field, its topic, and its reader are all gone.
- The whole existing suite stays green through each pull request.

## Sequencing

Three pull requests, each leaving the extension fully working.

1. **One meaning for a pillbox press.** Removes the defect. Needs no platform question settled.
2. **Chrome opens and closes the sidebar.** After the tab-switch hand test. Declares the minimum Chrome version.
3. **One state-change topic for the active table.** Folded into the messaging implementation, or landing after it.

## Living-doc impact

- `docs/vocabulary.md` — retire "panel" in favor of **sidebar**, and "report" in favor of **state-change topic**. The **application model** entry loses whether the sidebar is open from its list of application state.
- `docs/design.md` — the state paragraph loses the sidebar-open field; the messages paragraph loses the close topic and the second active-table topic.
- `chrome-extension/README.md` — check the description of what a pillbox press does against the one merged path.
