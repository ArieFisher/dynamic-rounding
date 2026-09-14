# Every cross-context topic on the event bus: request-reply design

- **Date:** 2026-09-11
- **Status:** approved design, implementation pending
- **Resolves:** issue #325, option A — one mechanism for all eighteen cross-context topics
- **Kind:** historical record. This document states the design as approved; the living docs track the system as built.

## Decision

The event bus gains a request-reply operation pair and a per-topic route table. Every cross-context topic moves onto the bus. The result: one delivery component, one topic table, one naming style, and one Chrome message listener per context.

The bus keeps two verbs because the eighteen topics are two kinds of message. Fifteen carry a fact or a gesture and return nothing. Three are requests: the receiver returns the settings, the lens preview samples, or the capture state to the publisher. A request and a one-way publish stay distinct operations; both travel through the same component and the same table.

## Corrections found during implementation planning

Read against the code on 2026-09-14. Three points in the design above do not hold against the extension as it stands; each is resolved here, and the sections below carry the resolution.

**The sender's tab number.** The service worker's page-unload handler reads the sending tab's number off the record Chrome attaches to every arriving message, and acts only when that tab is the one the sidebar was opened for. The bus hands subscribers the payload alone, and a payload cannot carry the number: a content script does not hold its own tab number. Moved as written, the handler would close the sidebar on a page unload in any tab. Resolution: a subscriber handler receives a second argument carrying the sending tab's number, `null` for a same-context publish and for a message from an extension page.

**The settings-apply topic is a fourth request.** The content script answers it, and the sidebar reads whether anyone answered at all to decide bound versus unbound. The count above of fifteen one-way topics and three requests is therefore fourteen and four. Resolution: the settings apply becomes the fourth request topic, and `opts.onDelivery` retires with it. One reply shape remains, which is the point of the change.

**The `both` route has no users.** The sidebar-state-removal change of 2026-09-14 retired the content-script leg of `CLOSE_SIDEBAR`, leaving it single-carrier. No topic needs two carriers. Resolution: the `both` route value is not built. Three route values ship: `null`, `extension-pages`, and `tab`.

## Vocabulary

Terms this design adds. They enter `docs/vocabulary.md` in the implementation branch that makes each one real.

| Term | Meaning |
| --- | --- |
| request topic | A topic whose one responder returns a plain-value answer to the publisher. The bus reports the absence of a responder to the publisher immediately, with no waiting period. |
| responder | The one function a context registers to answer a request topic. Exactly one responder per request topic; a second registration fails at that moment. |
| route | The table's record of which carrier reaches a topic's audience: the extension's pages, one tab's content script, or neither (same-context only). A route states carrier choice, never subscriber identity — publishers and subscribers stay unreferenced to each other. |

## Current state

Eighteen cross-context topic names exist. One travels through the bus (`intent:settingsChanged`, relayed under the `APPLY_SIDEBAR_SETTINGS` name). Seventeen travel as raw `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage` calls and land in inline name-comparison branches: one listener in the service worker, and two each in the sidebar and the content script (the bus relay plus an inline listener). Three of the seventeen are requests carrying Chrome's reply callback: `GET_SETTINGS`, `GET_PREVIEW_SAMPLES`, `GET_CAPTURE_STATE`.

Two topic lists exist (`DR_BUS.TOPICS` and `DR_CROSS_CONTEXT_TOPICS`), in two naming styles. Each sending site repeats its carrier choice. The sidebar repeats an active-tab lookup before each of its cross-context sends. The service worker re-sends `TABLE_TOGGLE_STATE` to the sidebar, which already receives the content script's broadcast directly, so the sidebar receives that report twice; the handler sets the same value both times, so nothing visible breaks.

## Design

### Request-reply operations

Two additions to the bus surface, beside `publish` and `subscribe`:

- `request(topic, payload, callback)` — sends a request topic and passes the responder's answer to the callback. When no responder is present (no content script on the tab, or none registered), the callback receives `undefined`; the bus consumes `chrome.runtime.lastError` so Chrome logs no warning. This preserves the load-bearing behavior the three requests have today: the absence of an answer arrives immediately and drives the sidebar's fallback to shipped defaults and to the unbound state.
- `respond(topic, handler)` — registers the topic's one responder. The handler receives the payload and returns the answer synchronously; the bus passes the return value to Chrome's `sendResponse`. All three responders are synchronous today, and the contract covers synchronous answers only; a later design extends it if an asynchronous responder ever appears. A second `respond` call for the same topic throws.

### The topic table

The bus's `TOPICS` table becomes the only topic list. Each entry holds:

- `family` — `intent`, `state-change`, or the new third family, `request`. The fifteen one-way topics take `intent` or `state-change` at move time; the assignment names the topic and changes no behavior.
- `route` — `null` (same-context only), `extension-pages`, or `tab`. A `request` family entry must carry route `tab`: a request addresses exactly one context, and the table-shape test fails closed on any other pairing.

The `wireAction` field retires: the topic name itself goes on the wire, in the `action` field the transport already uses. The implementation plan records the old-name-to-new-name mapping, one row per topic. `DR_CROSS_CONTEXT_TOPICS` and its misspelling guard retire with it — the bus's own unknown-topic check covers every name. One naming style remains, the bus's `family:name` form.

### Routes and transports

The route field replaces the bus's capability sniff. Today the bus picks a transport by testing which Chrome interface exists in the publishing context; after this change the table entry determines the transport:

- `extension-pages` — `chrome.runtime.sendMessage`, reaching the service worker and the open sidebar.
- `tab` — `chrome.tabs.sendMessage` to one tab's content script. The tab number comes from `opts.tabId` when the caller passes one; otherwise the bus queries the active tab. The two service-worker topics aimed at a specific tab (the menu-click tab, the sidebar's tab) pass `opts.tabId`, because only the service worker holds those numbers. The sidebar's repeated active-tab lookups collapse into the bus.

### Delivery order and the depth guard

`publish` delivers to same-context subscribers first, then relays over the topic's route, unchanged from the current bus. Moved topics become deliverable inside their publishing context; issue #325 accepts this. The publish-depth cap stays at its current value and now covers every topic, turning any new publish cycle into a clear error.

### What retires

- The three inline name-comparison listeners and the content script's second registration — each context keeps one Chrome listener, the bus's relay.
- The service worker's `TABLE_TOGGLE_STATE` re-send — the content script's single publish already reaches the sidebar, so the duplicate delivery ends.
- `DR_CROSS_CONTEXT_TOPICS`, its proxy guard, and the second naming style.
- The bus's transport sniff.

The service worker starts loading the bus file (`importScripts` gains `adapters/messaging.js`).

## What does not change

- Every payload shape and every topic's meaning. The move is mechanical: same messages, one mechanism.
- The settings pull fallback, the unbound-state signal, and the capture state pull, including the rule that a failed state pull still saves the capture.
- The bus holds no last-value cache and no history. A subscriber that attaches after a publish still pulls current state from the application model.
- Extension updates: page code already running loses its Chrome messaging link on update, so no mixed-name message can travel between versions. Renaming topics on the wire is safe.

## Rejected alternatives

- **Push-only, no requests** (event-carried state transfer): removes the reply path, so the absence of a receiver stops being detectable immediately; the sidebar would need waiting periods and stale-answer handling, or the bus would need last-value storage.
- **Subscriber-side filtering instead of routes**: pure delivery-everywhere with each context discarding what it did not subscribe to; floods every open tab on every publish to avoid recording a fact that never changes at runtime.
- **Issue #325 option B** (move fifteen, record the three requests as an exception): leaves two mechanisms permanently.

## Testing

Additions to the extension suite, with Chrome interfaces stubbed as the existing bus tests stub them:

- request-reply round trip: `respond` registered, `request` receives the answer.
- absent responder: `request` callback receives `undefined`; no unhandled `lastError`.
- one responder per topic: second `respond` throws.
- table shape, fail closed: every topic carries a family and a route; `request` family entries carry route `tab`; an entry missing either field fails the suite.
- depth guard covers a publish nested under a request's responder.
- duplicate-delivery regression: the sidebar receives the on/off report exactly once per change.
- the full existing suite stays green through each pull request.

## Sequencing

Three pull requests, each leaving the extension fully working:

1. **The bus grows the reply path and the route table.** `request`/`respond`, the `family`/`route` fields, the table-shape test, and the move of the one already-bussed topic onto a route entry. No other call site moves.
2. **The fifteen one-way topics move.** Inline branches retire as each topic moves; the service worker loads the bus; the duplicate re-send retires. Living docs update where invalidated.
3. **The three requests move.** `DR_CROSS_CONTEXT_TOPICS` and its guard retire; one naming style remains; `docs/vocabulary.md` gains the new terms and updates the definitions this change touches.

## Living-doc impact

- `docs/vocabulary.md` — **event bus** loses "within one context"; **cross-context topic** loses "rather than by the event bus" and "never back into the publishing context"; **topic** keeps its one-shared-list rule, now covering cross-context names; new entries per the Vocabulary section above.
- `docs/design.md` — the messaging description moves to one mechanism.
- `chrome-extension/README.md` — wherever it describes the two mechanisms.
