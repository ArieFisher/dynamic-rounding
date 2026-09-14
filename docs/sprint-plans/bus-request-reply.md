# Every cross-context topic on the event bus: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all eighteen cross-context topics onto the event bus, so the extension has one delivery component, one topic table, one naming style, and one Chrome message listener per context.

**Architecture:** The bus gains a request-reply operation pair (`request`/`respond`) and a per-topic `route` field that replaces its transport sniff. Each context's inline name-comparison listener retires in favor of `DR_BUS.subscribe` and `DR_BUS.respond` registrations. The service worker starts loading the bus.

**Tech Stack:** Plain ES5-compatible browser JavaScript, Chrome Manifest V3, a hand-rolled Node test suite (`chrome-extension/tests.js`) with stubbed `chrome.*` interfaces. No build step, no package manager.

**Spec:** `docs/specs/2026-09-11-bus-request-reply.md` (currently unmerged on branch `docs/bus-request-reply-spec`; Task 0 lands it, amended).

**Issue:** #325

---

## Global Constraints

- **Every pull request leaves the extension fully working.** Three pull requests, sequenced; no half-moved state ships.
- **The full suite stays green at every commit.** `node chrome-extension/tests.js` — baseline 2,184 passing, 0 failing. Also `node js/tests.js` and `node js/doc-tests.js`.
- **Never edit `main`.** Branch prefixes: `refactor/` for the three code pull requests, `docs/` for Task 0.
- **Never `git add .` or `git add -A`.** Stage paths by name. Run `scripts/check-files.sh --staged` before every commit.
- **Vocabulary gate.** `scripts/check-vocab.sh` blocks a commit when a line added to a markdown file contains a retired synonym. "wire action" is retired in favor of "cross-context topic". Define every new concept in `docs/vocabulary.md` on the branch that makes it real, as its own `docs:` commit.
- **No AI attribution** in any commit message, pull request body, code comment, or document.
- **`MAX_PUBLISH_DEPTH` stays 20.**
- **Payload shapes and topic meanings do not change.** The move is mechanical.
- **Existing code style:** the bus file uses an IIFE returning a frozen-by-convention object, `const`/`let`, no arrow-function-only syntax constraints, and long explanatory block comments above each mechanism. Match it.

---

## Three corrections to the approved spec

Found by reading the code against the spec. Task 0 writes all three into the spec before implementation starts.

**1. The sender's tab number.** The service worker's page-unload handler reads `sender.tab.id` to check the message came from the tab the sidebar was opened for. `deliverLocally` passes subscribers the payload alone. Moved as written, the worker would close the sidebar on any page unload in any tab. **Resolution (approved 2026-09-14):** `subscribe` handlers receive a second argument, `meta`, carrying `tabId` — the sending tab's number for a message that arrived over the wire from a content script, `null` for a same-context publish and for a message from an extension page.

**2. The settings-apply message is a fourth request.** The content script answers it with `{ ok: true }`, and the sidebar reads whether anyone answered at all to decide bound versus unbound. The spec counts three requests and treats this one as one-way. **Resolution (approved 2026-09-14):** it becomes the fourth request topic. `opts.onDelivery` retires with it, leaving one reply shape in the bus.

**3. The `both` route has no users.** The spec names `CLOSE_SIDEBAR` as the one topic needing both carriers. The 2026-09-14 sidebar-state-removal change (#334) retired that topic's content-script leg, so it is a single-carrier topic now. **Resolution:** the `both` route value is not built. Three route values ship: `null`, `extension-pages`, `tab`.

---

## Out of scope

- **Part three of the sidebar-state-removal spec** (merging the table-activated and table-switched topics into one state-change topic driven by the model's active-table setter). That is a behavior change; this plan is a mechanical move. Doing both at once makes the move unreviewable. This plan leaves both topics on the bus so part three becomes a small follow-on merge.
- **Issue #328** (per-table range expressions), **#330**, **#329**, **#332**, **#333**, **#336**. Unrelated.

## One interaction with part two of the sidebar spec

`docs/design.md` records that part two of the 2026-09-14 spec retires the service worker's tab number. That number is the only consumer of the `meta.tabId` argument Task 2 adds: the page-unload subscriber compares it against the tab the sidebar was opened for, and nothing else in the extension reads a sending tab.

Part two is blocked on two product calls with no date, and #325 does not wait for it. So `meta` gets built. Two points for whoever lands part two afterward:

- Retiring the worker's tab number retires the page-unload subscriber's comparison, and with it the last reader of `meta.tabId`.
- `meta` itself does not retire with that reader. It is the bus's contract for facts the carrier supplies rather than the publisher, and a later cross-context topic needing the sender's tab reaches for the same argument.

Whoever lands part two decides whether an argument with no reader stays. This plan does not prejudge it.

---

## File structure

| File | Change | Responsibility after |
| --- | --- | --- |
| `chrome-extension/adapters/messaging.js` | Modify (grows ~90 lines) | The only delivery component. Topic table with `family` and `route`; `publish`, `subscribe`, `request`, `respond`; one Chrome listener per context. |
| `chrome-extension/constants.js` | Modify (loses ~45 lines in Task 9) | Settings contract only. The cross-context topic list and its proxy guard retire. |
| `chrome-extension/background.js` | Modify | Loads the bus. Publishes and subscribes; no inline name comparison. |
| `chrome-extension/content.js` | Modify | Subscribes and responds; no Chrome listener of its own. |
| `chrome-extension/sidebar.js` | Modify | Publishes and requests; no Chrome listener of its own, no repeated active-tab lookup. |
| `chrome-extension/tests.js` | Modify | ~47 assertions coupled to the inline-branch source shape get rewritten against the bus. New bus behavior tests. |
| `docs/vocabulary.md` | Modify | Gains `request topic`, `responder`, `route`. Amends `event bus`, `topic`, `cross-context topic`. |
| `docs/design.md` | Modify (Task 12) | Messaging described as one mechanism. |
| `chrome-extension/README.md` | Modify (Task 12) | Same. |

**The bus file stays one file.** It reaches roughly 300 lines, inside the 200–400 typical band. Splitting the transport out would separate the route table from the code that reads it, which the repository's grouping rule forbids.

---

## The topic table

The complete old-name-to-new-name mapping. Every task below refers to this table; it is the single place the mapping is written.

| Old wire name | New topic | Family | Route | Publisher → audience |
| --- | --- | --- | --- | --- |
| `MENU_CLICKED` | `intent:menuClicked` | intent | `tab` | worker → content script (passes `tabId`) |
| `SIDEBAR_OPENED` | `state:sidebarOpened` | state-change | `tab` | worker → content script (passes `tabId`) |
| `CLOSE_SIDEBAR` | `intent:closeSidebar` | intent | `extension-pages` | worker → sidebar |
| `SIDEBAR_CLOSED` | `state:sidebarClosed` | state-change | `extension-pages` | sidebar → worker |
| `PAGE_UNLOADED` | `state:pageUnloaded` | state-change | `extension-pages` | content script → worker (needs `meta.tabId`) |
| `TABLE_ACTIVATED` | `state:tableActivated` | state-change | `extension-pages` | content script → sidebar |
| `TABLE_SWITCHED` | `state:tableSwitched` | state-change | `extension-pages` | content script → sidebar |
| `TABLE_TOGGLE_STATE` | `state:tableEnabledChanged` | state-change | `extension-pages` | content script → sidebar |
| `RANGE_ERROR` | `state:rangeError` | state-change | `extension-pages` | content script → sidebar |
| `RANGE_OK` | `state:rangeOk` | state-change | `extension-pages` | content script → sidebar |
| `APPLY_BLOCKED` | `state:applyBlocked` | state-change | `extension-pages` | content script → sidebar |
| `APPLY_OK` | `state:applyOk` | state-change | `extension-pages` | content script → sidebar |
| `PREVIEW_SAMPLES_CHANGED` | `state:previewSamplesChanged` | state-change | `extension-pages` | content script → sidebar |
| `UPDATE_MENU_LABEL` | `intent:updateMenuLabel` | intent | `extension-pages` | content script → worker |
| `APPLY_SIDEBAR_SETTINGS` | `request:applySettings` | request | `tab` | sidebar → content script |
| `GET_SETTINGS` | `request:settings` | request | `tab` | sidebar → content script |
| `GET_PREVIEW_SAMPLES` | `request:previewSamples` | request | `tab` | sidebar → content script |
| `GET_CAPTURE_STATE` | `request:captureState` | request | `tab` | sidebar → content script |

Family assignment rule, applied above: **intent** carries a gesture (someone did a thing, please act on it); **state-change** carries a fact (this changed); **request** carries a question.

Same-context topics already on the bus keep their names and take `route: null`: `intent:selectTable`, `intent:toggleTable`, `state:selectedTableChanged`, `state:settingsChanged`.

`intent:settingsChanged` retires — it becomes `request:applySettings`.

---

# Pull request 1 — the bus grows the reply path and the route table

Branch: `refactor/bus-reply-path`

No call site outside the bus moves, except the one already-bussed topic. The extension behaves identically at the end of this pull request.

---

### Task 0: Land the corrected spec

**Files:**
- Modify: `docs/specs/2026-09-11-bus-request-reply.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the spec on `main`, so the three code branches can cite it.

- [ ] **Step 1: Check out the existing spec branch and rebase it on main**

```bash
cd /Users/ariefisher/Projects/dynamic-rounding
git fetch origin
git checkout docs/bus-request-reply-spec
git rebase origin/main
```

- [ ] **Step 2: Add a corrections section to the spec**

Insert this section immediately after the `## Decision` section:

```markdown
## Corrections found during implementation planning

Read against the code on 2026-09-14. Three points in the design above do not
survive contact with the extension as it stands; each is resolved here.

**The sender's tab number.** The service worker's page-unload handler reads the
sending tab's number off the record Chrome attaches to every arriving message,
and acts only when that tab is the one the sidebar was opened for. The bus hands
subscribers the payload alone. Resolution: a subscriber handler receives a second
argument carrying the sending tab's number, `null` for a same-context publish and
for a message from an extension page.

**The settings-apply topic is a fourth request.** The content script answers it,
and the sidebar reads whether anyone answered at all to decide bound versus
unbound. Resolution: it becomes the fourth request topic, and `opts.onDelivery`
retires with it. One reply shape remains.

**The `both` route has no users.** The sidebar-state-removal change of 2026-09-14
retired the content-script leg of the close topic, leaving it single-carrier.
Resolution: the `both` route value is not built. Three route values ship: `null`,
`extension-pages`, and `tab`.
```

- [ ] **Step 3: Correct the two stale sentences in the body**

In the `### Routes and transports` section, delete this line:

```markdown
- `both` — both carriers, for the one topic that must reach the sidebar page and a tab's content script (`CLOSE_SIDEBAR` today).
```

In the same section's opening list, change `` `null` (same-context only), `extension-pages`, `tab`, or `both` `` to `` `null` (same-context only), `extension-pages`, or `tab` ``.

In the `### The topic table` section, the `route` bullet: same replacement.

- [ ] **Step 4: Run the repository gates**

```bash
scripts/check-vocab.sh --range origin/main HEAD
```
Expected: exit 0.

```bash
scripts/check-files.sh --staged
```
Expected: exit 0.

- [ ] **Step 5: Commit and open the pull request**

```bash
git add docs/specs/2026-09-11-bus-request-reply.md
git commit -m "docs: correct three points in the bus request-reply spec"
git push -u origin docs/bus-request-reply-spec
gh pr create --base main --title "Correct three points in the bus request-reply design spec" --body-file /tmp/pr0.txt
```

Write `/tmp/pr0.txt` first, with a `## Tested` section stating the two gate runs and a `## Manual tests` section stating "None — documentation only."

---

### Task 1: The route field replaces the transport sniff

**Files:**
- Modify: `chrome-extension/adapters/messaging.js`
- Test: `chrome-extension/tests.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `DR_BUS.TOPICS[topic].route`, one of `null`, `'extension-pages'`, `'tab'`. `DR_BUS.publish(topic, payload, opts)` where `opts.tabId` is a number and `opts.onDelivery` is a function (both optional, both still honored at this task; `onDelivery` retires in Task 5).

- [ ] **Step 1: Write the failing test**

Append to `chrome-extension/tests.js`, in the bus test region:

```js
// --- #325 Task 1: the topic table carries a route ---
(function busTableCarriesRoute() {
  const VALID_ROUTES = [null, 'extension-pages', 'tab'];
  let allHaveFamily = true;
  let allHaveValidRoute = true;
  for (const topic in DR_BUS.TOPICS) {
    const entry = DR_BUS.TOPICS[topic];
    if (typeof entry.family !== 'string' || entry.family.length === 0) allHaveFamily = false;
    if (!Object.prototype.hasOwnProperty.call(entry, 'route')) { allHaveValidRoute = false; continue; }
    if (VALID_ROUTES.indexOf(entry.route) === -1) allHaveValidRoute = false;
  }
  eq('bus table: every topic carries a non-empty family', allHaveFamily, true);
  eq('bus table: every topic carries a route drawn from the three valid values',
    allHaveValidRoute, true);
  eq('bus table: the table is not empty (fails closed on a lost table)',
    Object.keys(DR_BUS.TOPICS).length > 0, true);
  eq('bus table: no topic carries the retired wireAction field',
    Object.keys(DR_BUS.TOPICS).every((t) =>
      !Object.prototype.hasOwnProperty.call(DR_BUS.TOPICS[t], 'wireAction')), true);
})();
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node chrome-extension/tests.js 2>&1 | grep -A2 'bus table:'
```
Expected: the route and no-wireAction assertions FAIL.

- [ ] **Step 3: Replace the topic table and the transport sniff**

In `chrome-extension/adapters/messaging.js`, replace the `TOPICS` object with:

```js
  const REQUEST = 'request';

  // Route values. A topic's route states which carrier reaches its audience;
  // it never names a subscriber, so publishers and subscribers stay
  // unreferenced to each other.
  //   null              same-context only, no wire send
  //   'extension-pages' chrome.runtime.sendMessage — the service worker and
  //                     the open sidebar
  //   'tab'             chrome.tabs.sendMessage — one tab's content script
  const ROUTE_EXTENSION_PAGES = 'extension-pages';
  const ROUTE_TAB = 'tab';
  const VALID_ROUTES = [null, ROUTE_EXTENSION_PAGES, ROUTE_TAB];

  // The one place every topic name is enumerated.
  const TOPICS = {
    'intent:selectTable': { family: INTENT, route: null },
    'intent:toggleTable': { family: INTENT, route: null },
    'state:selectedTableChanged': { family: STATE_CHANGE, route: null },
    'state:settingsChanged': { family: STATE_CHANGE, route: null },
    // The sidebar's settings apply. A request: the content script answers, and
    // the sidebar reads whether anyone answered at all to decide bound versus
    // unbound. Task 5 moves the sidebar onto request(); until then publish()
    // still serves it through opts.onDelivery.
    'request:applySettings': { family: REQUEST, route: ROUTE_TAB },
  };
```

Delete the `wireActionToTopic` map and its build loop. Replace the transport-sniff block inside `publish` with:

```js
      const route = TOPICS[topic].route;
      if (!route || typeof chrome === 'undefined' || !chrome.runtime) return;
      relay(topic, payload, route, opts);
```

Add `relay` and its two carriers above `publish`:

```js
  // The route determines the carrier. Before this, publish() tested which
  // Chrome interface existed in the publishing context and inferred the
  // carrier from that; a topic whose audience did not match the inference had
  // no way to say so.
  function relay(topic, payload, route, opts) {
    const message = Object.assign({ action: topic }, payload);
    if (route === ROUTE_EXTENSION_PAGES) {
      sendToExtensionPages(message);
      return;
    }
    sendToTab(message, opts, null);
  }

  function sendToExtensionPages(message) {
    if (typeof chrome.runtime.sendMessage !== 'function') return;
    try {
      chrome.runtime.sendMessage(message, () => {
        // Touch lastError purely to consume it: with no extension page open
        // there is no receiver, and an unread lastError logs Chrome's
        // "Unchecked runtime.lastError" warning.
        void chrome.runtime.lastError;
      });
    } catch (e) {
      // extension context may not be available; harmless.
    }
  }

  // A tab-routed send needs a tab number. The caller supplies one through
  // opts.tabId when it holds one (only the service worker does — the menu
  // click's tab, the sidebar's tab); otherwise the bus queries the active tab,
  // which is the lookup the sidebar repeated before each of its own sends.
  //
  // onReply, when given, receives the responder's answer, or undefined when
  // nothing answered: no tab, no content script on it, or no responder
  // registered. The absence arrives immediately, with no waiting period.
  function sendToTab(message, opts, onReply) {
    if (!chrome.tabs || typeof chrome.tabs.sendMessage !== 'function') {
      // A tab-routed topic published from a context with no chrome.tabs (a
      // content script) cannot reach its audience. Fail loudly: a silent
      // return here is the exact miss the topic table exists to remove.
      throw new Error('DR_BUS: tab-routed topic "' + message.action +
        '" published from a context with no chrome.tabs');
    }
    const explicitTabId = opts && typeof opts.tabId === 'number' ? opts.tabId : null;
    const deliver = (tabId) => {
      try {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          void chrome.runtime.lastError;
          if (onReply) onReply(response);
          if (opts && typeof opts.onDelivery === 'function') opts.onDelivery();
        });
      } catch (e) {
        // no content script on this tab (or it has not loaded yet); harmless.
        if (onReply) onReply(undefined);
      }
    };
    if (explicitTabId !== null) {
      deliver(explicitTabId);
      return;
    }
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0]) {
          if (onReply) onReply(undefined);
          return;
        }
        deliver(tabs[0].id);
      });
    } catch (e) {
      if (onReply) onReply(undefined);
    }
  }
```

Replace the incoming-message listener's topic lookup — the name on the wire is now the topic name itself:

```js
    chrome.runtime.onMessage.addListener((request, sender) => {
      if (!request || typeof request.action !== 'string') return;
      if (!Object.prototype.hasOwnProperty.call(TOPICS, request.action)) return;
      const payload = Object.assign({}, request);
      delete payload.action;
      deliverLocally(request.action, payload, senderTabId(sender));
    });
```

- [ ] **Step 4: Update the sidebar's one publish to the new topic name**

In `chrome-extension/sidebar.js`, change the topic string on line 533 from `'intent:settingsChanged'` to `'request:applySettings'`. Leave `opts.onDelivery` in place.

- [ ] **Step 5: Update the content script's inline branch to match the new wire name**

In `chrome-extension/content.js`, the settings-apply branch compares against `DR_CROSS_CONTEXT_TOPICS.APPLY_SIDEBAR_SETTINGS`. Change the comparison to the literal new topic name:

```js
  if (request.action === 'request:applySettings') {
```

Delete `APPLY_SIDEBAR_SETTINGS` from `DR_CROSS_CONTEXT_TOPICS` in `chrome-extension/constants.js`.

- [ ] **Step 6: Run the full suite**

```bash
node chrome-extension/tests.js
```
Expected: 0 failing. Fix any assertion that pinned `wireAction` or the old topic name by rewriting it against `route` and the new name — do not weaken an assertion to make it pass.

- [ ] **Step 7: Commit**

```bash
git add chrome-extension/adapters/messaging.js chrome-extension/sidebar.js chrome-extension/content.js chrome-extension/constants.js chrome-extension/tests.js
git commit -m "refactor: give each topic a route and retire the bus transport sniff"
```

---

### Task 2: Subscribers receive the sending tab's number

**Files:**
- Modify: `chrome-extension/adapters/messaging.js`
- Test: `chrome-extension/tests.js`

**Interfaces:**
- Consumes: `relay`, `deliverLocally` from Task 1.
- Produces: `DR_BUS.subscribe(topic, handler)` where `handler(payload, meta)` and `meta` is `{ tabId: number | null }`. `tabId` holds the sending tab's number for a message that arrived over the wire from a content script; `null` for a same-context publish and for a message from an extension page.

- [ ] **Step 1: Write the failing test**

```js
// --- #325 Task 2: a subscriber learns the sending tab ---
(function busSubscriberReceivesSenderTab() {
  const seen = [];
  const off = DR_BUS.subscribe('state:settingsChanged', (payload, meta) => {
    seen.push(meta);
  });
  DR_BUS.publish('state:settingsChanged', { settings: {} });
  eq('bus meta: a same-context publish reports no sending tab',
    seen.length === 1 && seen[0] !== undefined && seen[0].tabId === null, true);
  off();
})();
```

Add a wire-side test beside the existing bus onMessage tests, using the suite's captured listener:

```js
(function busWireSubscriberReceivesSenderTab() {
  const seen = [];
  const off = DR_BUS.subscribe('state:settingsChanged', (payload, meta) => { seen.push(meta); });
  // The suite captures the bus's onMessage handler when messaging.js is
  // eval'ed; call it the way Chrome would, with a content-script sender.
  capturedBusOnMessageHandler(
    { action: 'state:settingsChanged', settings: {} },
    { tab: { id: 77 } },
    () => {}
  );
  eq('bus meta: a wire publish from a content script reports its tab number',
    seen.length === 1 && seen[0].tabId === 77, true);
  seen.length = 0;
  capturedBusOnMessageHandler(
    { action: 'state:settingsChanged', settings: {} },
    {},
    () => {}
  );
  eq('bus meta: a wire publish from an extension page reports no tab number',
    seen.length === 1 && seen[0].tabId === null, true);
  off();
})();
```

If `capturedBusOnMessageHandler` does not exist in the suite yet, add the capture beside the existing `capturedOnMessageHandler` at `chrome-extension/tests.js:11967`, following that pattern exactly.

- [ ] **Step 2: Run the test to verify it fails**

```bash
node chrome-extension/tests.js 2>&1 | grep 'bus meta:'
```
Expected: all three FAIL — `meta` is undefined.

- [ ] **Step 3: Implement**

In `chrome-extension/adapters/messaging.js`, add above `deliverLocally`:

```js
  // Chrome attaches a sender record to every arriving message. Only one fact
  // off it is load-bearing anywhere in the extension: which tab a content
  // script sent from (the service worker checks it against the tab the sidebar
  // was opened for). The bus passes that one number and keeps Chrome's record
  // out of its own contract. A same-context publish, and a message from an
  // extension page, both report null — neither has a tab.
  function senderTabId(sender) {
    return sender && sender.tab && typeof sender.tab.id === 'number' ? sender.tab.id : null;
  }
```

Change `deliverLocally` to carry the number through:

```js
  function deliverLocally(topic, payload, tabId) {
    const set = subscribers.get(topic);
    if (!set) return;
    const meta = { tabId: typeof tabId === 'number' ? tabId : null };
    for (const handler of Array.from(set)) {
      handler(payload, meta);
    }
  }
```

Change `publish`'s call to `deliverLocally(topic, payload, null)`.

- [ ] **Step 4: Run the tests**

```bash
node chrome-extension/tests.js
```
Expected: 0 failing.

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/adapters/messaging.js chrome-extension/tests.js
git commit -m "feat: report the sending tab's number to bus subscribers"
```

---

### Task 3: The request-reply operation pair

**Files:**
- Modify: `chrome-extension/adapters/messaging.js`
- Test: `chrome-extension/tests.js`

**Interfaces:**
- Consumes: `sendToTab`, `senderTabId`, `TOPICS`, `MAX_PUBLISH_DEPTH` from Tasks 1 and 2.
- Produces:
  - `DR_BUS.request(topic, payload, callback)` — `callback(answer)`, `answer` is `undefined` when nothing answered. Throws when the topic's family is not `request`.
  - `DR_BUS.respond(topic, handler)` — `handler(payload, meta)` returns the answer synchronously. Throws when the topic's family is not `request`, and throws when a responder is already registered for that topic.

- [ ] **Step 1: Write the failing tests**

```js
// --- #325 Task 3: request and respond ---
(function busRequestReplyRoundTrip() {
  // A round trip inside one context: respond registered here, and the wire
  // listener below delivers the request to it the way Chrome would.
  DR_BUS.respond('request:settings', (payload) => ({ settings: { echoed: payload.n } }));
  let answered = null;
  capturedBusOnMessageHandler(
    { action: 'request:settings', n: 5 },
    { tab: { id: 3 } },
    (response) => { answered = response; }
  );
  eq('bus request: the responder\'s return value reaches the asker',
    answered !== null && answered.settings.echoed === 5, true);
  DR_BUS._resetRespondersForTests();
})();

(function busRequestAbsentResponder() {
  // No responder registered, and no tab to reach: the callback runs with
  // undefined, immediately.
  let called = false;
  let answer = 'untouched';
  DR_BUS.request('request:captureState', {}, (a) => { called = true; answer = a; });
  eq('bus request: an absent responder yields undefined immediately', called, true);
  eq('bus request: the absent answer is undefined', answer, undefined);
})();

(function busOneResponderPerTopic() {
  DR_BUS.respond('request:previewSamples', () => 1);
  let threw = false;
  try { DR_BUS.respond('request:previewSamples', () => 2); } catch (e) { threw = true; }
  eq('bus request: a second responder for one topic throws', threw, true);
  DR_BUS._resetRespondersForTests();
})();

(function busRespondRejectsNonRequestFamily() {
  let threw = false;
  try { DR_BUS.respond('state:settingsChanged', () => 1); } catch (e) { threw = true; }
  eq('bus request: respond on a non-request topic throws', threw, true);
})();

(function busRequestRejectsNonRequestFamily() {
  let threw = false;
  try { DR_BUS.request('state:settingsChanged', {}, () => {}); } catch (e) { threw = true; }
  eq('bus request: request on a non-request topic throws', threw, true);
})();

(function busRequestFamilyImpliesTabRoute() {
  let allTabRouted = true;
  for (const topic in DR_BUS.TOPICS) {
    const entry = DR_BUS.TOPICS[topic];
    if (entry.family === 'request' && entry.route !== 'tab') allTabRouted = false;
  }
  eq('bus table: every request-family topic carries route "tab"', allTabRouted, true);
})();

(function busDepthGuardCoversResponders() {
  // A responder that publishes reenters the same depth counter a subscriber
  // does. An unguarded cycle through a responder becomes a clear error.
  DR_BUS.respond('request:settings', () => {
    DR_BUS.publish('state:settingsChanged', { settings: {} });
    return { settings: {} };
  });
  const off = DR_BUS.subscribe('state:settingsChanged', () => {
    // deliberate unguarded cycle
    DR_BUS.publish('state:settingsChanged', { settings: {} });
  });
  let threw = false;
  try {
    capturedBusOnMessageHandler({ action: 'request:settings' }, { tab: { id: 1 } }, () => {});
  } catch (e) {
    threw = /publish depth exceeded/.test(e.message);
  }
  eq('bus request: the depth guard covers a publish nested under a responder', threw, true);
  off();
  DR_BUS._resetRespondersForTests();
})();
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
node chrome-extension/tests.js 2>&1 | grep 'bus request:'
```
Expected: FAIL — `DR_BUS.request is not a function`.

- [ ] **Step 3: Implement**

Add to `chrome-extension/adapters/messaging.js`, after `publish`:

```js
  // A request topic has exactly one responder, in exactly one context. A
  // second registration is a mistake at the moment it is made, not later when
  // two answers race, so it throws here.
  const responders = new Map();

  function assertRequestFamily(topic, verb) {
    if (TOPICS[topic].family !== REQUEST) {
      throw new Error('DR_BUS: ' + verb + '() needs a request-family topic; "' +
        topic + '" is ' + TOPICS[topic].family);
    }
  }

  function respond(topic, handler) {
    assertKnownTopic(topic);
    assertRequestFamily(topic, 'respond');
    if (responders.has(topic)) {
      throw new Error('DR_BUS: topic "' + topic + '" already has a responder');
    }
    responders.set(topic, handler);
    return function unrespond() {
      if (responders.get(topic) === handler) responders.delete(topic);
    };
  }

  // A request addresses exactly one context, the tab's, so it never delivers
  // to same-context subscribers the way publish() does. The callback receives
  // the responder's answer, or undefined when nothing answered — no tab, no
  // content script on it, or no responder registered there. The absence
  // arrives immediately: the sidebar's fallback to shipped defaults and to the
  // unbound state depends on that, and always has.
  function request(topic, payload, callback) {
    assertKnownTopic(topic);
    assertRequestFamily(topic, 'request');
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.tabs ||
        typeof chrome.tabs.sendMessage !== 'function') {
      callback(undefined);
      return;
    }
    sendToTab(Object.assign({ action: topic }, payload), null, callback);
  }
```

Extend the incoming-message listener to run a responder. Replace the listener body from Task 1 with:

```js
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (!request || typeof request.action !== 'string') return;
      const topic = request.action;
      if (!Object.prototype.hasOwnProperty.call(TOPICS, topic)) return;
      const payload = Object.assign({}, request);
      delete payload.action;
      const meta = { tabId: senderTabId(sender) };
      if (TOPICS[topic].family === REQUEST) {
        const responder = responders.get(topic);
        // No responder in THIS context: stay silent rather than answer
        // undefined. Answering would close the asker's callback on behalf of a
        // context that holds no answer.
        if (!responder) return;
        publishDepth++;
        try {
          if (publishDepth > MAX_PUBLISH_DEPTH) {
            throw new Error(
              'DR_BUS: publish depth exceeded ' + MAX_PUBLISH_DEPTH +
              ' while responding to "' + topic + '" — likely an unguarded reentrant publish cycle'
            );
          }
          sendResponse(responder(payload, meta));
        } finally {
          publishDepth--;
        }
        return;
      }
      deliverLocally(topic, payload, meta.tabId);
    });
```

Export the new pair and a test-only reset:

```js
  return {
    publish, subscribe, request, respond, TOPICS,
    // Test-only. The suite registers responders across independent test
    // functions; without this, the one-responder rule would make the second
    // test in a file throw for the first test's registration.
    _resetRespondersForTests: function () { responders.clear(); },
  };
```

- [ ] **Step 4: Run the tests**

```bash
node chrome-extension/tests.js
```
Expected: 0 failing.

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/adapters/messaging.js chrome-extension/tests.js
git commit -m "feat: add request-reply to the event bus"
```

---

### Task 4: Rewrite the bus file's header comment

**Files:**
- Modify: `chrome-extension/adapters/messaging.js`

**Interfaces:**
- Consumes: everything above. Produces: nothing new.

- [ ] **Step 1: Replace the header block comment**

The header describes the transport sniff and `wireAction`, both retired. Rewrite it to state: three families (`intent`, `state-change`, `request`); the route field and its three values; the two delivery verbs and the request pair; the no-cache rule; the synchronous same-context delivery and the depth guard; the `meta.tabId` argument; that a request never delivers locally; and that each context registers exactly one Chrome listener, the bus's own. Keep the existing comment's density and its habit of stating why each rule exists.

Apply the writing rules from `AGENTS.md`: no personification, plain declarative sentences, no antithesis. A verb names an operation, never a stance.

- [ ] **Step 2: Run the suite**

```bash
node chrome-extension/tests.js
```
Expected: 0 failing.

- [ ] **Step 3: Commit**

```bash
git add chrome-extension/adapters/messaging.js
git commit -m "docs: rewrite the bus header for routes and request-reply"
```

---

### Task 5: The settings apply moves onto the request path

**Files:**
- Modify: `chrome-extension/sidebar.js:520-547`
- Modify: `chrome-extension/content.js:246-251`
- Modify: `chrome-extension/adapters/messaging.js`
- Test: `chrome-extension/tests.js`

**Interfaces:**
- Consumes: `DR_BUS.request`, `DR_BUS.respond` from Task 3.
- Produces: `opts.onDelivery` no longer exists. `publish`'s `opts` carries `tabId` alone.

- [ ] **Step 1: Write the failing test**

```js
// --- #325 Task 5: the settings apply is a request ---
(function settingsApplyUsesRequestPath() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  eq('settings apply: the sidebar asks through request()',
    /DR_BUS\.request\(\s*'request:applySettings'/.test(sidebarSrc), true);
  eq('settings apply: the sidebar no longer passes a delivery callback',
    sidebarSrc.includes('onDelivery'), false);
  eq('settings apply: the sidebar no longer reads lastError for this apply',
    /onDelivery[\s\S]{0,400}lastError/.test(sidebarSrc), false);

  const contentSrc = sourceByName('content.js');
  eq('settings apply: the content script answers through respond()',
    /DR_BUS\.respond\(\s*'request:applySettings'/.test(contentSrc), true);

  const busSrc = sourceByName('adapters/messaging.js');
  eq('settings apply: onDelivery retires from the bus', busSrc.includes('onDelivery'), false);
})();
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node chrome-extension/tests.js 2>&1 | grep 'settings apply:'
```
Expected: four FAIL.

- [ ] **Step 3: Rewrite the sidebar's apply**

Replace `applyNow` in `chrome-extension/sidebar.js`:

```js
// This page and the content script are separate extension contexts, so the
// settings change travels as a request: the content script records it and
// answers. The sidebar reads whether anyone answered at all, never the
// answer's value — no answer means no content script on the tab, which is
// exactly the unbound state.
//
// On an answer, clear only an unsourced stale message (the no-table
// reminder). A sourced message — a range error, an apply-blocked notice — is
// cleared by its own topic and must survive this callback: Chrome does not
// guarantee whether this answer or the content script's status message
// arrives first.
function applyNow() {
  DR_BUS.request('request:applySettings', { settings: currentSettings() }, (answer) => {
    if (!answer) {
      setTableBound(false);
    } else if (!statusEl.dataset.source) {
      statusEl.textContent = '';
    }
  });
}
```

- [ ] **Step 4: Rewrite the content script's branch as a responder**

Delete the `request:applySettings` branch from the inline listener in `chrome-extension/content.js` and add, beside the other `DR_BUS` registrations near the top of the file:

```js
// The sidebar's settings apply. Record it; the state-change subscriber above
// applies it to the table. The answer's only job is to exist: the sidebar
// reads that someone answered and stays bound.
DR_BUS.respond('request:applySettings', ({ settings }) => {
  DR_STORE.setSettings(settings || DR_DEFAULTS);
  return { ok: true };
});
```

- [ ] **Step 5: Delete `onDelivery` from the bus**

In `sendToTab`, delete the `opts.onDelivery` invocation and the `opts` parameter's `onDelivery` handling. `opts` keeps `tabId` alone. Update the `sendToTab` comment accordingly.

- [ ] **Step 6: Run the suite**

```bash
node chrome-extension/tests.js
```
Expected: 0 failing. Existing assertions naming `onDelivery` or `intent:settingsChanged` need rewriting against the request path; rewrite them, do not delete them.

- [ ] **Step 7: Commit**

```bash
git add chrome-extension/sidebar.js chrome-extension/content.js chrome-extension/adapters/messaging.js chrome-extension/tests.js
git commit -m "refactor: move the settings apply onto the bus request path"
```

---

### Task 6: Vocabulary for the three new terms

**Files:**
- Modify: `docs/vocabulary.md`

**Interfaces:** none.

- [ ] **Step 1: Add three rows to the term table**

Insert after the `subscriber` row (`docs/vocabulary.md:121`):

```markdown
| request topic | A **topic** whose one **responder** returns a **plain-value** answer to the publisher. The absence of a responder reaches the publisher immediately, with no waiting period. |
| responder | The one function a **context** registers to answer a **request topic**. Exactly one per request topic; a second registration fails at that moment. |
| route | A **topic**'s record of which carrier reaches its audience: the extension's pages, one tab's content script, or neither (same **context** only). A route states carrier choice, never subscriber identity. |
```

- [ ] **Step 2: Run the vocabulary gate**

```bash
scripts/check-vocab.sh --range origin/main HEAD
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add docs/vocabulary.md
git commit -m "docs: define request topic, responder, and route"
```

---

### Task 7: Open pull request 1

- [ ] **Step 1: Run every gate**

```bash
node chrome-extension/tests.js
```
```bash
node js/tests.js
```
```bash
node js/doc-tests.js
```
```bash
scripts/check-files.sh --staged
```
```bash
scripts/check-vocab.sh --range origin/main HEAD
```

- [ ] **Step 2: Request an independent review**

Behavior-changing pull requests get a `code-reviewer` pass before merge. Apply bucket-1 fixes in a `chore(...)` commit, fix bucket-2 findings with a test, and open `[follow-up]` issues for bucket-3.

- [ ] **Step 3: Push and open the pull request**

Body: what the bus can now do that it could not, why the route field replaces the sniff, why the settings apply is a request rather than a one-way publish with a delivery callback, and the three spec corrections. `## Tested` lists the five commands with results. `## Manual tests`: open the sidebar on a table page, change a setting, confirm the table re-rounds; close the tab's content script (navigate to a `chrome://` page) and confirm the sidebar shows unbound.

---

# Pull request 2 — the thirteen one-way topics move

Branch: `refactor/one-way-topics-on-bus`

Thirteen, not fifteen: the settings apply moved in pull request 1, and the four requests wait for pull request 3.

---

### Task 8: The service worker loads the bus and moves its topics

**Files:**
- Modify: `chrome-extension/background.js`
- Modify: `chrome-extension/adapters/messaging.js` (topic table)
- Test: `chrome-extension/tests.js`

**Interfaces:**
- Consumes: everything from pull request 1.
- Produces: the worker holds no `chrome.runtime.onMessage` listener of its own.

- [ ] **Step 1: Add the worker's four topics to the table**

In `chrome-extension/adapters/messaging.js`:

```js
    'intent:menuClicked': { family: INTENT, route: ROUTE_TAB },
    'state:sidebarOpened': { family: STATE_CHANGE, route: ROUTE_TAB },
    'intent:closeSidebar': { family: INTENT, route: ROUTE_EXTENSION_PAGES },
    'state:sidebarClosed': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
    'state:pageUnloaded': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
    'intent:updateMenuLabel': { family: INTENT, route: ROUTE_EXTENSION_PAGES },
```

- [ ] **Step 2: Write the failing test**

```js
// --- #325 Task 8: the service worker runs on the bus ---
(function workerRunsOnBus() {
  const bgSrc = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');
  eq('worker on bus: importScripts loads the messaging adapter',
    /importScripts\([^)]*adapters\/messaging\.js/.test(bgSrc), true);
  eq('worker on bus: no chrome.runtime.onMessage listener of its own',
    bgSrc.includes('chrome.runtime.onMessage.addListener'), false);
  eq('worker on bus: no raw chrome.tabs.sendMessage call',
    bgSrc.includes('chrome.tabs.sendMessage'), false);
  eq('worker on bus: the menu click publishes with an explicit tab number',
    /DR_BUS\.publish\(\s*'intent:menuClicked',\s*\{\},\s*\{\s*tabId:/.test(bgSrc), true);
  eq('worker on bus: the page-unload subscriber reads the sending tab from meta',
    /subscribe\(\s*'state:pageUnloaded',\s*\([^)]*meta[^)]*\)/.test(bgSrc), true);
  eq('worker on bus: the duplicate on/off re-send is gone',
    bgSrc.includes('tableEnabledChanged'), false);
})();
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
node chrome-extension/tests.js 2>&1 | grep 'worker on bus:'
```
Expected: all six FAIL.

- [ ] **Step 4: Rewrite the worker**

`chrome-extension/background.js`, line 8:

```js
importScripts('constants.js', 'adapters/messaging.js');
```

Replace the two menu sends:

```js
    DR_BUS.publish('intent:menuClicked', {}, { tabId: tab.id });
```
```js
    DR_BUS.publish('state:sidebarOpened', {}, { tabId: tab.id });
```

Replace the close send inside `closeSidebarIfOpen`:

```js
  DR_BUS.publish('intent:closeSidebar', {});
```

Replace the whole `chrome.runtime.onMessage.addListener` block with three subscriptions:

```js
DR_BUS.subscribe('intent:updateMenuLabel', ({ title }) => {
  chrome.contextMenus.update('dr-action', { title });
});

// meta.tabId is the tab the content script sent from. The worker acts only
// when that tab is the one the sidebar was opened for; without the number,
// any page unload in any tab would close the sidebar.
DR_BUS.subscribe('state:pageUnloaded', (payload, meta) => {
  if (meta.tabId !== null && meta.tabId === sidebarTabId) {
    closeSidebarIfOpen();
  }
});

DR_BUS.subscribe('state:sidebarClosed', () => {
  sidebarTabId = null;
});

// The on/off report needs no relay here. The content script's single publish
// already reaches the sidebar, so the re-send this worker used to make was a
// second delivery of one fact.
//
// The table-activation report needs no relay either. The content script
// broadcasts it to every extension page, which is where the sidebar reads it.
```

- [ ] **Step 5: Run the suite**

```bash
node chrome-extension/tests.js
```
Expected: failures in every test that eval'ed `background.js` with a bare `chrome` stub — the worker now needs `DR_BUS` on the eval scope. Extend those stubs (`chrome-extension/tests.js:12047` and neighbors) to eval `messagingCode` before `background.js`, matching how the content-script bundle is built at `chrome-extension/tests.js:94`.

- [ ] **Step 6: Rewrite the duplicate-delivery test**

The suite pins the worker's re-send at `chrome-extension/tests.js:11427-11500`. Replace it with the regression the spec calls for:

```js
// --- #325 Task 8: the on/off report reaches the sidebar exactly once ---
(function onOffReportDeliveredOnce() {
  const bgSrc = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');
  eq('one delivery: the worker subscribes to no on/off report',
    /subscribe\(\s*'state:tableEnabledChanged'/.test(bgSrc), false);
  eq('one delivery: the worker publishes no on/off report',
    /publish\(\s*'state:tableEnabledChanged'/.test(bgSrc), false);
  const contentSrc = sourceByName('content.js');
  eq('one delivery: the content script publishes it exactly once',
    contentSrc.split("publish('state:tableEnabledChanged'").length - 1, 1);
})();
```

- [ ] **Step 7: Run the suite**

```bash
node chrome-extension/tests.js
```
Expected: 0 failing.

- [ ] **Step 8: Commit**

```bash
git add chrome-extension/background.js chrome-extension/adapters/messaging.js chrome-extension/tests.js
git commit -m "refactor: run the service worker on the event bus"
```

---

### Task 9: The content script's nine outbound topics move

**Files:**
- Modify: `chrome-extension/content.js`
- Modify: `chrome-extension/adapters/messaging.js` (topic table)
- Test: `chrome-extension/tests.js`

**Interfaces:**
- Consumes: Task 8's table entries.
- Produces: `content.js` holds one Chrome listener carrying the four request branches alone.

- [ ] **Step 1: Add the remaining table entries**

```js
    'state:tableActivated': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
    'state:tableSwitched': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
    'state:tableEnabledChanged': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
    'state:rangeError': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
    'state:rangeOk': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
    'state:applyBlocked': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
    'state:applyOk': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
    'state:previewSamplesChanged': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
```

- [ ] **Step 2: Write the failing test**

```js
// --- #325 Task 9: the content script publishes through the bus ---
(function contentPublishesThroughBus() {
  const contentSrc = sourceByName('content.js');
  eq('content on bus: no raw chrome.runtime.sendMessage call',
    contentSrc.includes('chrome.runtime.sendMessage'), false);
  eq('content on bus: no reference to the retired cross-context topic list',
    contentSrc.includes('DR_CROSS_CONTEXT_TOPICS'), false);
  for (const topic of ['state:tableActivated', 'state:tableSwitched',
      'state:tableEnabledChanged', 'state:rangeError', 'state:rangeOk',
      'state:applyBlocked', 'state:applyOk', 'state:previewSamplesChanged',
      'state:pageUnloaded', 'intent:updateMenuLabel']) {
    eq('content on bus: publishes ' + topic,
      contentSrc.includes("publish('" + topic + "'"), true);
  }
  eq('content on bus: the menu click arrives as a subscription',
    /DR_BUS\.subscribe\(\s*'intent:menuClicked'/.test(contentSrc), true);
  eq('content on bus: the sidebar-opened report arrives as a subscription',
    /DR_BUS\.subscribe\(\s*'state:sidebarOpened'/.test(contentSrc), true);
})();
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
node chrome-extension/tests.js 2>&1 | grep 'content on bus:'
```
Expected: FAIL.

- [ ] **Step 4: Replace every raw send in `content.js`**

Each raw send becomes a publish. The `try`/`catch` wrappers around them retire — the bus already swallows a send into a torn-down context. Using the topic table above:

```js
      DR_BUS.publish('state:tableSwitched', {});
```
```js
      DR_BUS.publish('state:tableEnabledChanged', { enabled: nextEnabled });
```
```js
    DR_BUS.publish('state:tableActivated', {});
```
```js
    DR_BUS.publish('state:rangeError', { error: result.error });
```
```js
    DR_BUS.publish('state:rangeOk', {});
```
```js
        DR_BUS.publish('state:previewSamplesChanged', {});
```
```js
    DR_BUS.publish('state:pageUnloaded', {});
```
```js
    DR_BUS.publish('state:applyBlocked', { count: unrestorableCount });
```
```js
  DR_BUS.publish('state:applyOk', {});
```
```js
      DR_BUS.publish('intent:updateMenuLabel', { title: 'Toggle readable data' });
```

- [ ] **Step 5: Move the two inbound branches to subscriptions**

Delete the `MENU_CLICKED` and `SIDEBAR_OPENED` branches from the inline listener and add, beside the other `DR_BUS` registrations:

```js
// The menu item reports the same intent a pillbox press reports, so both run
// the one controller path. The right-click that opened the menu already made
// the table active, so the press lands as an unmoved one: it flips the
// settings record's on/off value and keeps the range expression (#275).
DR_BUS.subscribe('intent:menuClicked', () => {
  if (!lastRightClickedElement) return;
  const found = findTargetTable(lastRightClickedElement, { isSeen: DR_STORE.hasTable });
  if (!found) {
    DR_LOG.debug('Dynamic Rounding: No table found at right-click location.');
    return;
  }
  DR_BUS.publish('intent:toggleTable', { table: markAndToggleIfNewGrid(found) });
});

// Reconnect: pull the model's own active table and settings — the sidebar may
// be reopening after a close, and the model holds both of record.
DR_BUS.subscribe('state:sidebarOpened', () => {
  const selected = DR_STORE.getSelectedTable();
  if (!selected) {
    DR_LOG.debug('Dynamic Rounding: No table targeted. Right-click a table cell first.');
    return;
  }
  applySidebarRounding(selected, DR_STORE.getSettings());
  // Tell the sidebar its view is stale; it re-reads the model's settings and
  // re-asks for preview samples against the now-current active table.
  DR_BUS.publish('state:previewSamplesChanged', {});
});
```

These registrations must sit after `markAndToggleIfNewGrid`, `findTargetTable`, and `applySidebarRounding` are defined, or use function declarations that hoist. `markAndToggleIfNewGrid` and `applySidebarRounding` are function declarations, so they hoist; `lastRightClickedElement` is a `let` — place the subscriptions after its declaration.

- [ ] **Step 6: Delete the moved names from the constants file**

Remove every name from `DR_CROSS_CONTEXT_TOPICS` in `chrome-extension/constants.js` except the four request names. Update the block comment above it to say four names remain and that they retire in the next change.

- [ ] **Step 7: Run the suite and fix the coupled assertions**

```bash
node chrome-extension/tests.js
```

Roughly 30 assertions pin the raw-send shape. Rewrite each against the bus publish, keeping what it actually checks. Where a test asserted a send happened, assert the publish happened. Where a test asserted ordering (the activation report ahead of the blocked-apply report), keep the ordering assertion and change only the shape it matches.

- [ ] **Step 8: Commit**

```bash
git add chrome-extension/content.js chrome-extension/adapters/messaging.js chrome-extension/constants.js chrome-extension/tests.js
git commit -m "refactor: publish the content script's reports through the bus"
```

---

### Task 10: The sidebar's inbound branches become subscriptions

**Files:**
- Modify: `chrome-extension/sidebar.js:589-668`
- Test: `chrome-extension/tests.js`

**Interfaces:**
- Consumes: Task 9's table entries.
- Produces: `sidebar.js` holds no Chrome listener of its own.

- [ ] **Step 1: Write the failing test**

```js
// --- #325 Task 10: the sidebar subscribes instead of listening ---
(function sidebarSubscribesThroughBus() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  eq('sidebar on bus: no chrome.runtime.onMessage listener of its own',
    sidebarSrc.includes('chrome.runtime.onMessage.addListener'), false);
  for (const topic of ['state:tableActivated', 'intent:closeSidebar', 'state:rangeError',
      'state:rangeOk', 'state:applyBlocked', 'state:applyOk',
      'state:previewSamplesChanged', 'state:tableSwitched', 'state:tableEnabledChanged']) {
    eq('sidebar on bus: subscribes to ' + topic,
      sidebarSrc.includes("subscribe('" + topic + "'"), true);
  }
  eq('sidebar on bus: the unload report publishes through the bus',
    /DR_BUS\.publish\(\s*'state:sidebarClosed'/.test(sidebarSrc), true);
})();
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node chrome-extension/tests.js 2>&1 | grep 'sidebar on bus:'
```
Expected: FAIL.

- [ ] **Step 3: Replace the listener with nine subscriptions**

Each branch's body moves verbatim into its own subscription; only the dispatch shape changes. Keep every existing explanatory comment with the body it explains. The nine, in the branch order they hold today:

```js
DR_BUS.subscribe('state:tableActivated', () => { flashSidebarContainer(); });
DR_BUS.subscribe('intent:closeSidebar', () => { window.close(); });
DR_BUS.subscribe('state:rangeError', ({ error }) => { /* existing body */ });
DR_BUS.subscribe('state:rangeOk', () => { /* existing body */ });
DR_BUS.subscribe('state:applyBlocked', () => { /* existing body */ });
DR_BUS.subscribe('state:applyOk', () => { /* existing body */ });
DR_BUS.subscribe('state:previewSamplesChanged', () => { pullSettingsAndApplyToUI(); });
DR_BUS.subscribe('state:tableSwitched', () => { /* existing body */ });
DR_BUS.subscribe('state:tableEnabledChanged', ({ enabled }) => { /* existing body */ });
```

Replace `request.error` with the destructured `error` and `request.enabled` with `enabled` inside the moved bodies.

- [ ] **Step 4: Replace the unload send**

```js
window.addEventListener('unload', () => {
  DR_BUS.publish('state:sidebarClosed', {});
});
```

- [ ] **Step 5: Run the suite and fix the coupled assertions**

```bash
node chrome-extension/tests.js
```

Roughly 15 assertions locate a sidebar handler block by the `request.action === ...` text. Rewrite each to locate the subscription block instead, keeping what each one checks. The block-isolation sanity checks at `chrome-extension/tests.js:5700` and the runtime eval at `chrome-extension/tests.js:11985` both need their regexes updated.

- [ ] **Step 6: Commit**

```bash
git add chrome-extension/sidebar.js chrome-extension/tests.js
git commit -m "refactor: subscribe the sidebar's reports through the bus"
```

---

### Task 10b: The design doc's flow description

**Files:**
- Modify: `docs/design.md`

**Interfaces:** none.

Pull request 2 falsifies four passages in `docs/design.md`. AGENTS.md requires a behavior-changing pull request to update every living doc its change invalidates, on the same branch. Each passage below is quoted by its opening words so it can be found exactly.

- [ ] **Step 1: The Flow section, first paragraph**

It reads "a raw listener inside the controller turns the menu item's into an intent topic; the sidebar's settings intent exists but has no subscriber, so its raw listener does that work instead." Both raw listeners are gone. Rewrite the paragraph: three producers reach one controller, and all three publish on the bus — the pillbox press and the menu item as intent topics, the sidebar's controls as a request the controller answers.

- [ ] **Step 2: The Flow section, second paragraph**

It reads "no state-change topic reaches it, because no state-change topic carries a cross-context name." That is false as of this pull request: the sidebar subscribes to eight state-change topics. Rewrite: the sidebar pulls current values when it opens, and redraws on the state-change topics it subscribes to.

Leave the sentence about the active-table state-change topic having no subscriber — part three of the 2026-09-14 spec still owns it.

- [ ] **Step 3: The Flow section, the "**Messages.**" paragraph**

It states two topic families and only two, names `intent:settingsChanged`, and states that every cross-context topic name is declared once in `constants.js`. Rewrite: three families — intent, state-change, and request; a topic's route determines which contexts a publish reaches; the bus's own table is the one topic list. Name the four requests. Keep the sentence explaining that the publish call is the same whether or not a topic crosses contexts, which is still true and still the point.

The constants-file claim holds until pull request 3 retires that list. State it as four request names remaining there, or defer the whole sentence's rewrite to Task 13 and say so in the pull request body.

- [ ] **Step 4: The Layers section, the two-breaks paragraph**

It reads "the controller, both views, and the service worker all hold Chrome calls of their own." Half of that break closes here. Rewrite to name what remains: the worker's context-menu and side-panel lifecycle calls, and the two views writing the page directly. Messaging is no longer among them.

- [ ] **Step 5: Run the gates**

```bash
scripts/check-vocab.sh --range origin/main HEAD
```
```bash
node js/doc-tests.js
```
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add docs/design.md
git commit -m "docs: describe the flow with every report on the bus"
```

---

### Task 11: Open pull request 2

- [ ] **Step 1: Run every gate** (same five commands as Task 7).

- [ ] **Step 2: Request an independent review.**

- [ ] **Step 3: Push and open the pull request.**

Body: why the worker now loads the bus, why the duplicate on/off delivery ends, and the one behavior a reviewer cannot read off the diff — a moved topic is now deliverable inside its publishing context, which #325 accepts. `## Manual tests`: right-click toggle on a table; open the sidebar and switch tabs; trigger a blocked apply on a re-rendered table and confirm the sidebar locks and lifts.

---

# Pull request 3 — the three remaining requests move

Branch: `refactor/requests-on-bus`

---

### Task 12: The three pulls become requests

**Files:**
- Modify: `chrome-extension/sidebar.js:376-391`, `:720-737`, `:788-800`, `:936-953`
- Modify: `chrome-extension/content.js:207-276`
- Modify: `chrome-extension/adapters/messaging.js` (topic table)
- Modify: `chrome-extension/constants.js`
- Test: `chrome-extension/tests.js`

**Interfaces:**
- Consumes: `DR_BUS.request`, `DR_BUS.respond`.
- Produces: `DR_CROSS_CONTEXT_TOPICS` no longer exists. `content.js` holds no Chrome listener.

- [ ] **Step 1: Add the three table entries**

```js
    'request:settings': { family: REQUEST, route: ROUTE_TAB },
    'request:previewSamples': { family: REQUEST, route: ROUTE_TAB },
    'request:captureState': { family: REQUEST, route: ROUTE_TAB },
```

- [ ] **Step 2: Write the failing test**

```js
// --- #325 Task 12: one mechanism, one topic list ---
(function oneMechanismRemains() {
  const contentSrc = sourceByName('content.js');
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const bgSrc = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');
  const constantsSrc = sourceByName('constants.js');

  eq('one mechanism: the constants file holds no cross-context topic list',
    constantsSrc.includes('DR_CROSS_CONTEXT_TOPICS'), false);
  eq('one mechanism: the content script holds no Chrome message listener',
    contentSrc.includes('chrome.runtime.onMessage.addListener'), false);
  eq('one mechanism: the sidebar makes no raw tab send',
    sidebarSrc.includes('chrome.tabs.sendMessage'), false);
  eq('one mechanism: the sidebar runs no active-tab lookup of its own',
    sidebarSrc.includes('chrome.tabs.query'), false);
  eq('one mechanism: the worker holds no Chrome message listener',
    bgSrc.includes('chrome.runtime.onMessage.addListener'), false);

  for (const topic of ['request:settings', 'request:previewSamples', 'request:captureState']) {
    eq('one mechanism: the content script answers ' + topic,
      contentSrc.includes("respond('" + topic + "'"), true);
    eq('one mechanism: the sidebar asks ' + topic,
      sidebarSrc.includes("request('" + topic + "'"), true);
  }

  // Every topic name follows the bus's one naming style.
  let allNamed = true;
  for (const topic in DR_BUS.TOPICS) {
    if (!/^(intent|state|request):[a-z][A-Za-z]*$/.test(topic)) allNamed = false;
  }
  eq('one mechanism: every topic name follows the family:name style', allNamed, true);
  eq('one mechanism: the table holds all eighteen cross-context topics plus the four same-context ones',
    Object.keys(DR_BUS.TOPICS).length, 22);
})();
```

- [ ] **Step 3: Rewrite the sidebar's four pull sites**

Each loses its `chrome.tabs.query` wrapper — the bus does that lookup once.

`fetchPreviewSamples`:

```js
function fetchPreviewSamples() {
  DR_BUS.request('request:previewSamples', {}, (answer) => {
    if (!answer) {
      cachedSamples = null;
      cachedMaxMag = null;
      setTableBound(false);
    } else {
      cachedSamples = answer.samples;
      cachedMaxMag = answer.maxMag;
      setTableBound(answer.samples !== null);
    }
    renderPreviewBands();
  });
}
```

`pullSettingsAndApplyToUI`:

```js
function pullSettingsAndApplyToUI() {
  DR_BUS.request('request:settings', {}, (answer) => {
    if (!answer || !answer.settings) {
      applyDefaultsToUI();
    } else {
      applySettingsToUI(answer.settings);
    }
    fetchPreviewSamples();
  });
}
```

Keep the existing comment above it: the preview fetch runs only after the settings pull settles, never in parallel.

`refreshCaptureSizeNote`:

```js
function refreshCaptureSizeNote() {
  if (!captureSizeNoteEl) return;
  captureSizeNoteEl.hidden = true;
  DR_BUS.request('request:captureState', {}, (answer) => {
    if (!answer) return;
    const warning = DR_CAPTURE.sizeWarning(answer);
    // The mark re-check drops an answer that lands after the form folded.
    if (warning !== null && captureMark !== null) {
      captureSizeNoteEl.textContent = warning;
      captureSizeNoteEl.hidden = false;
    }
  });
}
```

`saveCapture`:

```js
function saveCapture() {
  if (captureMark === null) return;
  const mark = captureMark;
  const note = captureRemarksEl ? captureRemarksEl.value : '';
  DR_LOG.debug('Dynamic Rounding: finish pressed; asking for capture state.');
  DR_BUS.request('request:captureState', {}, (answer) => {
    if (!answer) {
      DR_LOG.warn('Dynamic Rounding: capture state request went unanswered.');
      assembleAndSaveCapture(mark, note, null);
      return;
    }
    assembleAndSaveCapture(mark, note, answer);
  });
}
```

The rule that a failed state pull still saves the capture holds: the unanswered branch calls `assembleAndSaveCapture` with `null`.

- [ ] **Step 4: Rewrite the content script's three branches as responders**

Delete the whole `chrome.runtime.onMessage.addListener` block from `content.js` and add:

```js
// The sidebar asks the model instead of holding its own copy.
DR_BUS.respond('request:settings', () => ({ settings: DR_STORE.getSettings() }));

DR_BUS.respond('request:previewSamples', () => {
  const selected = DR_STORE.getSelectedTable();
  if (!selected) return { samples: null, maxMag: null };
  return extractPreviewSamples(selected);
});

DR_BUS.respond('request:captureState', () => buildCaptureStateResponse());
```

- [ ] **Step 5: Delete the constants list**

Remove `DR_CROSS_CONTEXT_TOPICS`, its `NAMES` object, its `TOPIC_SHAPED` guard, and the proxy from `chrome-extension/constants.js`. Remove the sentence naming it from the file's header comment. The bus's own unknown-topic check now covers every name.

Remove the `DR_CROSS_CONTEXT_TOPICS` global assignment from the test bootstrap at `chrome-extension/tests.js:88`.

- [ ] **Step 6: Fix the no-chrome end-to-end test**

At `chrome-extension/tests.js:14788` the test patches out `content.js`'s one Chrome listener so the file loads with no `chrome` global. There is no listener now, and no top-level `chrome` reference at all. Replace the needle-count assertion and the patch with:

```js
  eq('no-chrome e2e: content.js registers no Chrome message listener of its own',
    contentSrc.split('chrome.runtime.onMessage.addListener(').length - 1, 0);
  // No patch needed: every remaining chrome.* reference in content.js sits
  // inside a function body this test never calls. Loading the file unpatched
  // is a stronger check than loading a patched copy.
  const noChromeContentSrc = contentSrc;
```

- [ ] **Step 7: Run the suite and fix the coupled assertions**

```bash
node chrome-extension/tests.js
```
Expected: 0 failing. Roughly 12 assertions name the three pull actions or the constants list; rewrite each against the request path.

- [ ] **Step 8: Commit**

```bash
git add chrome-extension/sidebar.js chrome-extension/content.js chrome-extension/adapters/messaging.js chrome-extension/constants.js chrome-extension/tests.js
git commit -m "refactor: move the three remaining pulls onto the bus request path"
```

---

### Task 13: Living docs and vocabulary

**Files:**
- Modify: `docs/vocabulary.md`
- Modify: `docs/design.md`
- Modify: `chrome-extension/README.md`

**Interfaces:** none.

- [ ] **Step 1: Amend three vocabulary entries**

`event bus` (`docs/vocabulary.md:117`) — delete "within one **context**". Add a sentence: a topic's **route** determines which contexts a publish reaches.

`topic` (`:118`) — keep the one-shared-list rule and state that the list now covers cross-context names too. Delete "within one **context**".

`cross-context topic` (`:122`) — delete "rather than by the event bus" and delete the third difference, "It goes only to other contexts, never back into the publishing context." Keep the plain-value rule and the immediate-return rule.

- [ ] **Step 2: Check the retired-synonym table**

`docs/vocabulary.md:186` retires "wire action" in favor of "cross-context topic". The retirement stands; the field that carried the name is gone. Leave the row.

- [ ] **Step 3: Update the four remaining `docs/design.md` passages**

Task 10b handled the Flow section and the Layers break. Four passages remain, each quoted by its opening words.

**The package table's constants row** reads "Every shared constant, loaded by all three contexts: the settings contract (each option's name and default) and every cross-context topic name." The list is gone. Cut the trailing clause; the row describes the settings contract alone.

**The Patterns table, the Request-and-reply row** reads "The sidebar's three pulls" and "Raw Chrome messaging today; the approved messaging design moves it onto the event bus." It is four now, not three — the settings apply joined them — and the move is done. Rewrite the Where cell as the sidebar's four requests, and the Job cell as one caller, one answer, on demand, on the event bus.

**The Patterns table, the Intent-and-state-change row** reads "Views to the controller, and the model to the controller." The sidebar now subscribes to state-change topics, so the model reaches a view too. Rewrite the Where cell.

**The Decisions bullet** reads "Two messaging primitives are the target... The event bus carries the publish today, while the sidebar's three pulls use raw Chrome messaging; the approved messaging design moves every cross-context topic onto the bus under the two." The target is reached. Rewrite it as a statement of what holds: two primitives, a publish that returns nothing and a request that returns one answer, both on the event bus, with a topic's route determining which contexts a publish reaches.

- [ ] **Step 3b: Update `chrome-extension/README.md`**

```bash
grep -n 'chrome.runtime\|chrome.tabs\|cross-context\|listener\|constants.js' chrome-extension/README.md
```

Rewrite every hit that describes two delivery mechanisms, a per-context inline listener, or the constants file's topic list.

- [ ] **Step 4: Run the gates**

```bash
scripts/check-vocab.sh --range origin/main HEAD
```
```bash
node js/doc-tests.js
```
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/vocabulary.md docs/design.md chrome-extension/README.md
git commit -m "docs: describe messaging as one mechanism"
```

---

### Task 14: Open pull request 3

- [ ] **Step 1: Run every gate** (the five commands from Task 7).

- [ ] **Step 2: Request an independent review.**

- [ ] **Step 3: Push and open the pull request.**

Body: one mechanism, one topic list, one naming style, one listener per context. Name the two rules that survive unchanged and that a reviewer would otherwise have to verify by hand — the sidebar falls back to shipped defaults and to the unbound state when nothing answers, and a failed capture-state request still saves the capture. `## Manual tests`: open the sidebar with no table right-clicked and confirm the shipped defaults and the unbound bands; open it on a `chrome://` page and confirm unbound; save a capture from a page with no bound table and confirm the file writes.

---

## Review items for each pull request

Three things a reviewer should check that no test asserts:

1. **A moved topic is now deliverable inside its publishing context.** No context should both publish and subscribe the same moved topic. Check each pull request's diff for that pairing.
2. **Publish order.** The suite pins the activation report ahead of the blocked-apply report on a table switch. Confirm the publish order in `content.js` preserves it.
3. **The bus is loaded before its first use in every context.** The manifest's content-script order, `sidebar.html`'s script order, and `background.js`'s `importScripts` list all place `adapters/messaging.js` before the file that uses it.
