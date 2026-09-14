# The extension stops tracking whether the sidebar is open

- **Date:** 2026-09-14
- **Status:** approved design. Part one shipped (#334). Parts two and three pending; part two's design changes — see the addendum at the foot of this document.
- **Review:** two independent passes, each returning BLOCK; this document carries their findings
- **Opens:** #328 (one settings record cannot describe two simplified tables)
- **Closes on landing:** #241
- **Kind:** historical record. This document states the design as approved; the living docs track the system as built.

## Decision

No part of the extension keeps a copy of whether the sidebar is open. A pillbox press means one thing, always. Chrome's own calls open and close the sidebar. One state-change topic carries the active table.

Three parts, each landing on its own. Part one removes a user-visible defect. Parts two and three close the paths that would bring it back under a different cause.

## The defect

Each page holds its own answer to whether the sidebar is open. Only the service worker sends the correction, and the correction needs the tab number. Two paths lose that number: Chrome empties the service worker's variables after an idle spell, and an ordinary sidebar close clears the number without sending the page anything. Four events could still trigger the correction — a tab reloading, a tab closing, the user switching tabs, a page unloading — and all four begin by comparing against the number that is gone. Every comparison fails, so none of the four runs.

With the answer wrong, a pillbox press on a table that is not the active one takes the rebind path instead of on and off. The user presses what looks like an on/off control and gets a control that moves the sidebar to a table. Where the settings record's on/off value stands at off, such a press changes no numbers, and a second press works, so the control reads as intermittent.

The only recovery today is a page reload.

## Current state

**Three press paths.** A press takes one of three. The sidebar is open and the pressed table is not the active one, so the pressed table becomes active and the settings record applies to it. The pressed table is already the active one, so the settings record's on/off value flips, with the direction read from the screen. Neither holds, so a plain simplify with the shipped defaults, or a form flip back to the originals that leaves the markers and the stored originals in place.

Only the first path reads whether the sidebar is open, and it is the only reader in the extension.

**Two topics for one fact.** A right-click activating a table publishes one cross-context topic, and the sidebar flashes. A press moving the sidebar to a different table publishes another, and the sidebar clears a locked table's notice and re-reads. Both carry the fact that the active table changed, both sit inside a gesture handler, and the application model already publishes that same change on a state-change topic with no subscribers.

**The service worker holds state.** It keeps the tab number the sidebar opened for, and closes the sidebar by publishing a topic the sidebar page acts on by closing itself. That publish is a broadcast to the extension's own pages and carries no tab number, so the number serves two jobs: it addresses the second leg of the close, the one aimed at the page, and it tests which tab an event concerns. Three of the four triggers fire for every tab, so the test carries the weight.

## Design

### Part one: one meaning for a pillbox press

A press makes the pressed table active and flips its form from what the screen shows, writing the settings record. The settings record's change drives the apply. The three paths become one, and the read of whether the sidebar is open loses its last caller.

**A press writes the settings record.** Two visible behaviors follow from that one choice, and one choice settles both: turning on uses the settings record's current values, and turning off resets the table, clearing its markers and its stored originals.

Three reasons. The pillbox, the sidebar's switch, and the right-click menu then all write the settings record and let one apply path run, where two run today. A capture carries the settings record, so a press that bypassed it would make a capture carry values that did not produce the table on the screen. And the form flip back to simplified currently re-applies each table's last-used options, so a sidebar change made between an off press and an on press has no effect today; writing through the settings record closes that path.

**A press that changes the active table clears the range expression.** A range expression states rows and columns by position, so it describes the table someone wrote it for. Carrying it to a second table addresses different data, and an expression the parser rejects stops the press before any cell changes, with the error reaching a sidebar that may stand closed. Such a press therefore clears the expression and simplifies the whole table, until the user writes a new expression.

A press on the table that is already active keeps the expression. The reason for the clear runs out there: that table is the one the expression describes.

The clear travels inside the press's one settings write, and activation carries no settings write of its own. Every settings write publishes, and the controller applies to the active table on every publish, so a clear written on its own would apply. Two results follow. A right-click activation would change numbers, where today it changes none. And a press writing twice — the clear, then the flip — would read the screen for its direction after the first write had already changed the screen: a press on a raw table with the on/off value at on simplifies, then the flip reads simplified and writes off, and the second apply resets the table to where it started.

The rule, therefore: a press reads its flip direction before any write, and makes one settings write carrying the cleared expression and the flipped on/off value together. A right-click activation writes no settings.

What that leaves in place: a right-click activation carries the settings record's expression, written for some other table, into the next apply that runs for the newly active table — the apply the sidebar triggers when it opens. The sidebar displays that expression at the same moment, so the cause is on the screen. #328 closes this along with the rest.

Retiring with this part: the page's copy of whether the sidebar is open, the model field behind it, its state-change topic, the close topic's leg to the page, and the code the merge leaves with no caller — the plain-toggle helper, the form-flip helper, and the restore path's keep-the-markers branch.

### Part two: Chrome opens and closes the sidebar

The service worker calls Chrome's close, addressed by tab, in place of publishing a topic the sidebar acts on. Chrome's reference records the call as a no-op when nothing is open for that tab, so the service worker closes the tab an event concerns without holding which tab the sidebar opened for.

Chrome's close event reaches the service worker on an ordinary close and carries the tab, in place of the sidebar publishing its own unload.

Retiring with this part: the close topic, the sidebar's self-close handler, the sidebar's unload topic, and the service worker's tab number as a held fact. The service worker still needs a tab to open the sidebar and to aim the right-click topic, and both arrive with the menu event.

**One ordering.** A fifth reader gates the on/off relay to the sidebar on the same tab number. The approved messaging design retires that relay in its second pull request, because the content script's broadcast already reaches the sidebar. Part two landing first means removing the gate on its own, and removing the gate without removing the relay restores a duplicate delivery. Part two therefore follows the messaging design's second pull request, or retires the relay itself.

### Part three: one state-change topic for the active table

One topic replaces the two. The publish follows the application model's active-table change. The state-change topic with no subscribers gains one, and the two hand-written cross-context topics become one.

Both of the model's unsubscribed state-change topics end up resolved, by opposite routes: the active-table one gains its subscriber, and the sidebar-open one retires with the field behind it.

The existing suite pins the order of two sends on a table switch, the active-table topic ahead of the blocked-apply topic. The merged path preserves that order only where the activation precedes the settings-record write, so the activation goes first.

**Activation publishes on a change of table alone.** The model's active-table setter publishes on every call, with no equality check, so a press on the already-active table would publish the active-table topic and make the sidebar re-read and flash every time. The existing suite pins no switch topic on a same-table press, and that test holds the gate.

## Platform findings

This section records the platform facts once. Source: Chrome's extension side-panel reference, read 2026-09-14.

| Capability | Since | Detail |
| --- | --- | --- |
| Close call | Chrome 141 | Takes a tab or a window, at least one of the two. A no-op when the sidebar is already closed. |
| Close event | Chrome 142 | Carries the path, the window, and, where the sidebar was tab-specific, the tab. |
| Open call | Chrome 116 | A tab opens a sidebar for that tab alone. A window opens one for every tab in that window. |

Chrome stable stands between 152 and 154 this month, so both additions are roughly a year old. The manifest declares no minimum Chrome version today, and part two declares 142.

Three things the reference leaves unstated, which this design therefore leaves unassumed: whether two browser windows show the extension's sidebar at the same time, whether Chrome hides a tab-specific sidebar by itself when the user switches tabs, and what the close call does for a tab that has already closed.

## The open questions

Both belong to part two, and a hand test settles both. Part one proceeds without either answer.

**Switching tabs.** Chrome's event carries the tab switched to and never the tab left, so closing the sidebar the user walked away from needs either the window form of the close call or one held tab number. The reference implies a tab-specific sidebar is already hidden on a switch without stating it, and the answer determines whether the service worker holds anything at all.

**A closed tab.** The close call names a tab, and on a tab that has just closed that tab is gone. Either the call is safe there, or Chrome closes a tab-specific sidebar along with its tab and the trigger goes. The existing suite pins today's handling of this case, so whichever answer holds, that test changes with it.

## Consequences beyond the defect

1. A press on a table that is not the active one applies the settings record's current values where it previously applied the shipped defaults. The two agree until a sidebar session changes them, with the range expression handled above.
2. A press moves the active table where today it leaves the active table alone. Three things beyond the sidebar's own reaction read the active table: the apply that runs when the sidebar opens, the lens preview, and the capture, which carries the active table's markup as its fixture seed. Right-click table A, press table B's pillbox, then open the sidebar: the sidebar binds B and applies to B, where today it binds A.
3. The sidebar reacts in one case where it did not. One topic means one reaction, so a right-click also triggers a re-read and a press also flashes the sidebar. Inside that union: a right-click on a locked table lifts the sidebar's lock with no apply behind it, so the controls read unlocked until the next apply locks them again.
4. The settings record describes one table. Making every press write it makes the mismatch with a table left simplified elsewhere on the page reachable from any press. #328 carries this, and the mismatch predates this change.
5. The minimum Chrome version rises to 142, and an install below that stops receiving updates. At stable 152 the affected population is negligible.
6. The approved messaging design shrinks. Eighteen cross-context topics become fifteen, the route that reaches both the extension's pages and a tab loses its only topic, and the page-unload topic becomes a candidate once the platform event covering a tab navigating away is confirmed.

## What does not change

- Simplification itself: the classification ladder, the offsets, the dataset, and the magnitude freeze.
- Locked tables. A locked pillbox publishes nothing on a press, so the wrong-direction flip in #277 keeps its single entry point through the right-click menu.
- The magnitude re-freeze across a form round trip (#257). Today's form flip and the new reset both clear the frozen magnitude on the way back to simplified.
- Nothing persists. The settings record still starts as the shipped defaults on every page load and dies with the page.

## Rejected alternatives

- **Hold the tab number across a service-worker restart.** Closes one of the two loss paths. An ordinary close still sends the page nothing, so a second fix follows, and the page still holds a copy that other causes spoil.
- **Ask instead of hold.** Keep the press paths, and have the page ask at the moment of the press, which preserves today's behavior exactly. Costs an asynchronous press, and widens the approved messaging design's route rule to allow a request aimed at the extension's pages, where two contexts receive it and only one may answer.
- **Keep the form flip on the way off.** Both paths walk the simplified cells once on the way off, so the saving is bookkeeping alone: the form flip keeps the markers and the stored originals. It leaves the settings record standing at off while the table keeps its simplified bookkeeping, and it re-applies each table's last-used options, so a sidebar change made between the two presses has no effect.
- **Act at the table and leave the settings record alone.** Keeps each table independent and keeps a spoiled settings record from disabling every pillbox. It reopens #272: after such a press the sidebar's switch shows a value for a table whose form disagrees, which is the coupling an earlier change removed. A hybrid that writes only the on/off value and applies the table's own options restores two apply paths and a capture whose settings did not produce the bound table.

## Testing

Additions to the extension suite, with Chrome interfaces stubbed as the existing suite stubs them.

- The defect's own symptom: the settings record's on/off value stands at off, a press lands on a table that is not the active one, and the table simplifies.
- One press path: a press on a table that is not the active one makes it active and flips its form, with no read of any sidebar value.
- A press writes the settings record, and the settings record's change is what applies to the table.
- A press turning simplification on uses the settings record's current values.
- Turning off resets: after an off press no cell carries the simplified marker and no cell has a stored original.
- A press that changes the active table clears the range expression, including where the held expression fails to parse. A press on the already-active table keeps it.
- A press makes exactly one settings write, and the flip direction comes from the screen as it stood before that write. A press on a raw table with the on/off value at on leaves the table simplified.
- A right-click activation writes no settings, so the numbers on a right-clicked table stay as they are. Today's code satisfies this, and the test stands as a regression guard on the clear's placement: a clear moved back onto activation breaks it.
- The close call carries the tab of the event that triggered it, and nothing goes to the page.
- The close event updates the service worker without the sidebar publishing an unload topic. The observable depends on the first open question's answer.
- One state-change topic carries the active table, from a right-click and from a press, with the activation ahead of the apply topics.
- No code reads a held sidebar-open value: the field, its topic, and its reader are all gone.

Existing tests pin the retired behavior and change with part one. They form part one's test plan: the source scan of the sidebar-open guard, the two acceptance tests asserting no switch topic while the sidebar stands closed, the sidebar-open topic's place in the topic list and its use as the reentrancy fixture, that topic's round trip, the unconnected-table test asserting the activation stays put, the close topic's routing to the tab, the two source scans of the sidebar-open setter, and the switch-pull test asserting that the range expression survives a table switch.

Two candidate tests carry no weight, so the plan omits them: that two presses return a table to where it started, which today's third path already satisfies, and that a locked pillbox publishes nothing, which the view already guarantees.

## Sequencing

Three pull requests, each leaving the extension fully working.

1. **One meaning for a pillbox press.** Removes the defect. Needs no platform question settled.
2. **Chrome opens and closes the sidebar.** After both hand tests, and after the messaging design's second pull request or its relay retirement. Declares the minimum Chrome version.
3. **One state-change topic for the active table.** No dependency on part two. Folded into the messaging implementation, or landing after it.

## Living-doc impact

- `docs/vocabulary.md` — the **application model** entry drops whether the sidebar is open from its list of application state. The retirements and the four new terms land ahead of the code, in this branch.
- `docs/design.md` — the State ownership subsection drops whether the sidebar is open, the service worker's held fact, and the two marker-class reads part one retires; the messages paragraph drops the close topic and the second active-table topic; the decisions list gains the press's one write.
- `chrome-extension/README.md` — the description of what a pillbox press does, against the one merged path.

---

## Addendum, 2026-09-14 evening: the open questions, answered

This section records what hand tests found after part one landed. It adds to the document above; it changes none of it. Part one shipped as approved (#334). Part two's design changes, and this addendum is where that starts.

### Part one shipped

Merged as #334, with two decisions the approved design does not carry, both recorded in its commit and its pull request body: the on/off send to the sidebar goes only on a press that did not move the active table, and the restore step's keep-the-markers mode stays unreachable rather than removed (#332). Two further findings routed to issues: #333 for suite clutter the retirement left, #336 for a README sentence describing a control the sidebar does not show.

### Finding 1: the sidebar is a global panel, so closing it by tab is unavailable

The manifest registers the sidebar with a default path, which enables it on every tab. Nothing narrows it to one tab. Chrome's reference states the consequence directly: the close call's tab form closes a tab-specific sidebar, and where only the global sidebar is open the call rejects.

A hand test confirms it. Calling the close with the tab the sidebar was opened for rejects with "No active tab-specific side panel for tabId". The control call, with a tab number no tab ever held, rejects with "No tab with id" instead, so Chrome separates the two failures and the first one is the documented case, not a missing tab.

Part two's plan was for the service worker to close the sidebar by naming a tab. That call does not reach this sidebar. Two routes, and the choice is a product one:

- **Close by window.** One call, no other change. A window's sidebar covers every tab in it, so closing it for one tab closes it for all of them.
- **Make the sidebar tab-specific.** Declare the sidebar for a tab before opening it, and disable it elsewhere. This matches the product as it already behaves — one bound table, in one tab — and it makes the tab form of the close work. It adds code and adds states.

### Finding 2: Chrome does not hide the sidebar on a tab switch

The first open question above asked whether Chrome hides a tab-specific sidebar by itself when the user switches tabs. It does not hide this one, because this one is global and a global sidebar shows on every tab by design.

What looked like Chrome hiding it is the extension closing it. The evidence is an asymmetry between the two ways to open the sidebar. Opened through the right-click menu item, it disappears on a tab switch and does not return. Opened through Chrome's own extension menu, it survives every switch.

The cause: the service worker records the tab only when its own menu item opens the sidebar, and all three close triggers are gated on that record. A sidebar Chrome opened leaves the record empty, so no trigger fires.

This reverses the assumption part two rested on. The service worker does have to close the sidebar itself, if closing on a tab switch is behavior worth keeping.

### Finding 3: a new product question

Opened through Chrome's extension menu, the sidebar already survives tab switches, and nothing about the extension breaks. Two users of the same build therefore get different behavior depending on which entry point they used.

Whether the sidebar should close on a tab switch at all is now an open product question, and part two's shape depends on the answer. Closing is not free: it costs the sidebar's controls and its capture form, which the user then rebuilds by reopening.

### What part two still waits on

The platform questions are settled. Part two still follows the messaging design's second pull request, or retires the on/off relay itself, for the reason the approved text gives. The two routes under Finding 1 and the question under Finding 3 are decisions for the product manager, not findings.
