// The event bus: its topic table, routes, carriers, requests, and replies (app/bus.js).

// ---------------------------------------------------------------------------
// Statelessness. The bus
// keeps no last-value cache and no delivery history (see app/bus.js
// header) — a subscriber that attaches AFTER a publish must never see that
// publish, unlike an EventEmitter with replay or a BehaviorSubject.
// ---------------------------------------------------------------------------
(function busLateSubscriberMissesPastPublish() {
  const topic = 'state:rangeOk';
  // Publish BEFORE any subscriber of this test attaches — nothing is listening
  // yet.
  DR_BUS.publish(topic, {});

  let received = 'NOT_CALLED';
  const unsubscribe = DR_BUS.subscribe(topic, (payload) => { received = payload; });
  try {
    eq('DR_BUS statelessness: a subscriber that attaches after a publish never receives that publish',
      received, 'NOT_CALLED');
  } finally {
    unsubscribe();
  }
})();

// ---------------------------------------------------------------------------
// Reentrancy. Same-context
// delivery is synchronous (see deliverLocally in app/bus.js), so a subscribed
// handler may itself call DR_BUS.publish() for a different topic before
// returning. A two-topic cycle — A's handler publishes B; B's handler
// increments a counter and, guarded to do so only once, publishes A back —
// must settle without an infinite loop or a stack overflow.
// ---------------------------------------------------------------------------
(function busGuardedTwoTopicCycleSettles() {
  // The second topic is state:settingsChanged: the content script holds no
  // subscriber of its own for it, so only the fixture's handlers run here.
  // The test measures the bus's own delivery under a nested publish.
  const TOPIC_A = 'state:rangeOk';
  const TOPIC_B = 'state:settingsChanged';
  let counter = 0;

  const unsubA = DR_BUS.subscribe(TOPIC_A, () => {
    DR_BUS.publish(TOPIC_B, { source: 'page', settings: Object.assign({}, DR_DEFAULTS) }); // A's handler always publishes B
  });
  const unsubB = DR_BUS.subscribe(TOPIC_B, () => {
    counter++;
    if (counter === 1) {
      DR_BUS.publish(TOPIC_A, {}); // guarded to bounce back to A only once
    }
  });

  let threw = null;
  try {
    DR_BUS.publish(TOPIC_A, {}); // kick off the cycle
  } catch (e) {
    threw = e.message;
  } finally {
    unsubA();
    unsubB();
  }

  eq('DR_BUS reentrancy: a guarded two-topic publish cycle completes without throwing (no infinite loop/stack overflow)',
    threw, null);
  eq('DR_BUS reentrancy: B fires exactly twice (initial A->B hop, then one guarded bounce back through A)',
    counter, 2);
})();

// ---------------------------------------------------------------------------
// The depth guard itself. The guarded cycle
// above is self-limiting (a caller-side counter stops it after one bounce);
// this one is NOT — neither handler has a stop condition, so without the
// bus's own guard this would recurse until the real call stack overflows.
// ---------------------------------------------------------------------------
(function busUnguardedCycleTerminatesSafely() {
  const TOPIC_A = 'state:rangeOk';
  const TOPIC_B = 'state:settingsChanged';

  const unsubA = DR_BUS.subscribe(TOPIC_A, () => { DR_BUS.publish(TOPIC_B, { source: 'page', settings: Object.assign({}, DR_DEFAULTS) }); });
  const unsubB = DR_BUS.subscribe(TOPIC_B, () => { DR_BUS.publish(TOPIC_A, {}); });

  let threw = null;
  try {
    DR_BUS.publish(TOPIC_A, {});
  } catch (e) {
    threw = e.message;
  } finally {
    unsubA();
    unsubB();
  }

  eq('DR_BUS reentrancy (unguarded cycle): publish() throws a catchable error instead of crashing with a real stack overflow',
    typeof threw, 'string');
  eq('DR_BUS reentrancy (unguarded cycle): the thrown error holds "publish depth exceeded", not a raw engine stack-overflow error',
    /publish depth exceeded/.test(threw || ''), true);

  // The guard must reset cleanly — every nested publish() decrements the
  // depth counter in a finally as the exception unwinds — so an unrelated
  // publish afterward must behave normally, not still read as "deep".
  let secondThrew = null;
  const unsubCheck = DR_BUS.subscribe(TOPIC_A, () => {});
  try {
    DR_BUS.publish(TOPIC_A, {});
  } catch (e) {
    secondThrew = e.message;
  } finally {
    unsubCheck();
  }
  eq('DR_BUS reentrancy (unguarded cycle): a later unrelated publish does not throw',
    secondThrew, null);
})();

// ---------------------------------------------------------------------------
// The bus's topic table is the one declaration of every topic name.
//
// A name written out again at a call site risks a mistyped character, which
// produces a message no listener matches, with no error and no log row. The
// bus builds every message itself from its table, so no context file
// needs a name of its own. These pin both halves.
// ---------------------------------------------------------------------------

(function theBusHoldsEveryTopicName() {
  const contextFiles = {
    'content.js': sourceByName('content.js') || '',
    'table-pillbox-view.js': tablePillboxViewCode || '',
    'toast-view.js': sourceByName('toast-view.js') || '',
    'app/model.js': modelCode || '',
    'sidebar.js': fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8'),
    'background.js': fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8'),
  };

  // The bus is the only file that puts a topic field on a message. A
  // context file writing one is reaching around the topic table.
  for (const [name, src] of Object.entries(contextFiles)) {
    const literals = (src.match(/topic(?::|\s*===)\s*['"][A-Za-z][A-Za-z0-9_:]*['"]/g) || []);
    eq(`one topic list: ${name} builds no message of its own`, literals, []);
  }

  // Every name in the table is reachable: it appears in at least one context
  // file. A name left behind after its last use is clutter the next reader
  // has to rule out.
  const allContextSrc = Object.values(contextFiles).join('\n');
  const declared = Object.keys(DR_BUS.TOPICS);
  const unused = declared.filter((topic) => !allContextSrc.includes("'" + topic + "'"));
  eq('one topic list: every declared topic is used by at least one context file',
    unused, []);
})();

// --- The topic table carries a route ---
(function busTableCarriesRoute() {
  const VALID_ROUTES = [null, 'extension-pages', 'tab'];
  let allHaveFamily = true;
  let allHaveValidRoute = true;
  for (const topic in DR_BUS.TOPICS) {
    const entry = DR_BUS.TOPICS[topic];
    if (typeof entry.family !== 'string' || entry.family.length === 0) allHaveFamily = false;
    if (!Object.prototype.hasOwnProperty.call(entry, 'route')) { allHaveValidRoute = false; }
    else if (VALID_ROUTES.indexOf(entry.route) === -1) { allHaveValidRoute = false; }
  }
  eq('bus table: every topic carries a non-empty family', allHaveFamily, true);
  eq('bus table: every topic carries a route drawn from the three valid values',
    allHaveValidRoute, true);
})();

// --- The route determines the carrier, not the publishing context ---
(function busRouteDeterminesCarrier() {
  // The carrier never follows from which Chrome interface the publishing
  // context holds.

  // A tab-routed topic with no explicit tab ID: the bus runs the active-tab
  // lookup. The payload
  // here is the bus's contract under test, not the topic's production payload —
  // the menu click carries none.
  const b = makeBusSandbox();
  b.bus.publish('intent:menuClicked', { probe: 1 });
  eq('bus route: a tab topic queries the active tab once', b.sent.queries, 1);
  eq('bus route: and sends to that tab', b.sent.tabs.length, 1);
  eq('bus route: aimed at the tab the query answered with',
    b.sent.tabs.length === 1 ? b.sent.tabs[0].tabId : null, 7);
  eq('bus route: the message carries the topic name itself',
    b.sent.tabs.length === 1 ? b.sent.tabs[0].msg.topic : null, 'intent:menuClicked');
  eq('bus route: the message carries the payload beside the name, nothing else',
    b.sent.tabs.length === 1 ? Object.keys(b.sent.tabs[0].msg).sort().join(',') : null,
    'probe,topic');

  // An explicit tab ID skips the lookup. The service worker passes the
  // tab the user clicked in, which may not be the active one.
  const c = makeBusSandbox();
  c.bus.publish('intent:menuClicked', {}, { tabId: 42 });
  eq('bus route: an explicit tab ID skips the active-tab lookup', c.sent.queries, 0);
  eq('bus route: and addresses the tab the caller named',
    c.sent.tabs.length === 1 ? c.sent.tabs[0].tabId : null, 42);

  // The reason for the throw sits in sendToTab in app/bus.js.
  const d = makeBusSandbox({ noTabs: true });
  let threw = false;
  try { d.bus.publish('intent:menuClicked', {}); } catch (e) { threw = true; }
  eq('bus route: a tab topic published where chrome.tabs is absent throws', threw, true);

  // The extension-pages route takes the other carrier: the broadcast that
  // reaches the service worker and the open sidebar, and never a content
  // script. It needs no tab ID, so it runs no active-tab lookup.
  const f = makeBusSandbox();
  f.bus.publish('state:rangeOk', {});
  eq('bus route: an extension-pages topic broadcasts once', f.sent.pages.length, 1);
  eq('bus route: and sends into no tab', f.sent.tabs.length, 0);
  eq('bus route: and runs no active-tab lookup', f.sent.queries, 0);
  eq('bus route: the broadcast message carries the topic name',
    f.sent.pages.length === 1 ? f.sent.pages[0].topic : null, 'state:rangeOk');

  // An extension-pages publish from a context with no chrome.tabs reaches its
  // audience: that carrier needs none. An absent interface is no reason to
  // send on the other carrier.
  const g = makeBusSandbox({ noTabs: true });
  g.bus.publish('state:rangeOk', {});
  eq('bus route: an extension-pages topic sends from a context with no chrome.tabs',
    g.sent.pages.length, 1);

  // A same-context topic sends nothing either way.
  const e = makeBusSandbox();
  e.bus.publish('intent:activateTable', { table: null });
  eq('bus route: a route-less topic sends on no carrier',
    e.sent.pages.length + e.sent.tabs.length, 0);
})();

// --- publish() throws on a request topic rather than dropping its answer ---
//
// request() and respond() throw on a topic outside the request family.
// publish() throws on a request topic too: it would send the message, the
// responder would answer, and the answer would go nowhere, with nothing logged
// and nothing failed.
(function busPublishOnRequestTopicThrows() {
  const a = makeBusSandbox();
  let message = '';
  try {
    a.bus.publish('request:applySettings', { settings: {} });
  } catch (e) {
    message = e.message;
  }
  eq('one-way guard: publishing a request topic throws', message.length > 0, true);
  eq('one-way guard: the error names the topic and points at request()',
    message.includes('request:applySettings') && message.includes('request()'), true);
  eq('one-way guard: and nothing goes out on either carrier',
    a.sent.pages.length + a.sent.tabs.length, 0);

  const b = makeBusSandbox();
  let requestThrew = false;
  try { b.bus.request('intent:menuClicked', {}, () => {}); } catch (e) { requestThrew = true; }
  eq('one-way guard: request() on a one-way topic throws', requestThrew, true);
  let respondThrew = false;
  try { b.bus.respond('intent:menuClicked', () => {}); } catch (e) { respondThrew = true; }
  eq('one-way guard: respond() on a one-way topic throws', respondThrew, true);
})();

// --- A subscriber learns the sending tab ---
//
// The bus reads the tab ID of the sending tab off Chrome's sender record and
// hands it to each subscriber as meta.tabId. The sidebar acts only on a
// message whose meta.tabId matches its bound tab's tab ID. A payload cannot
// carry the number — a content script does not hold its own.
(function busSubscriberReceivesSenderTab() {
  const a = makeBusSandbox();
  const sameContext = [];
  a.bus.subscribe('state:settingsChanged', (payload, meta) => { sameContext.push(meta); });
  a.bus.publish('state:settingsChanged', { settings: {} });
  eq('bus meta: a same-context publish reports no sending tab',
    sameContext.length === 1 && sameContext[0] && sameContext[0].tabId === null, true);

  const b = makeBusSandbox();
  const fromTab = [];
  b.bus.subscribe('state:settingsChanged', (payload, meta) => { fromTab.push(meta); });
  b.fire({ topic: 'state:settingsChanged', settings: {} }, { tab: { id: 77 } });
  eq('bus meta: a message from a content script reports its tab ID',
    fromTab.length === 1 && fromTab[0].tabId === 77, true);

  const c = makeBusSandbox();
  const fromPage = [];
  c.bus.subscribe('state:settingsChanged', (payload, meta) => { fromPage.push(meta); });
  c.fire({ topic: 'state:settingsChanged', settings: {} }, {});
  eq('bus meta: a message from an extension page reports no tab ID',
    fromPage.length === 1 && fromPage[0].tabId === null, true);

  // The payload stays exactly what the publisher sent. The reason sits on
  // deliverLocally in app/bus.js.
  const d = makeBusSandbox();
  let seenPayload = null;
  d.bus.subscribe('state:settingsChanged', (payload) => { seenPayload = payload; });
  d.fire({ topic: 'state:settingsChanged', settings: { k: 1 } }, { tab: { id: 5 } });
  eq('bus meta: the tab ID stays out of the payload',
    seenPayload === null ? null : Object.keys(seenPayload).sort().join(','), 'settings');
})();

// --- Request and respond ---
(function busRequestReplyRoundTrip() {
  // The publisher's side: the answer Chrome hands back reaches the callback.
  const a = makeBusSandbox({ reply: { settings: { k: 9 } } });
  let answer = 'untouched';
  a.bus.request('request:applySettings', { settings: {} }, (x) => { answer = x; });
  eq('bus request: the answer reaches the publisher',
    answer && answer.settings ? answer.settings.k : null, 9);

  // The responder's side: its return value goes to Chrome's reply
  // callback, unwrapped.
  const b = makeBusSandbox();
  b.bus.respond('request:applySettings', (payload) => ({ echoed: payload.n }));
  let replied = 'untouched';
  b.fire({ topic: 'request:applySettings', n: 5 }, { tab: { id: 3 } }, (r) => { replied = r; });
  eq('bus request: the responder\'s return value is what the publisher receives',
    replied && replied.echoed, 5);

  // A responder receives the sending tab's tab ID the same way a subscriber does.
  const c = makeBusSandbox();
  let responderMeta = null;
  c.bus.respond('request:applySettings', (payload, meta) => { responderMeta = meta; return {}; });
  c.fire({ topic: 'request:applySettings' }, { tab: { id: 11 } }, () => {});
  eq('bus request: a responder receives the sending tab too',
    responderMeta ? responderMeta.tabId : null, 11);
})();

(function busRequestAbsentResponder() {
  // Three ways nothing answers. Each must reach the callback with undefined,
  // immediately. The reason sits above request() in app/bus.js.
  const noTab = makeBusSandbox({ noActiveTab: true });
  let a = 'untouched';
  let aCalled = false;
  noTab.bus.request('request:applySettings', {}, (x) => { aCalled = true; a = x; });
  eq('bus request: no active tab answers undefined', aCalled && a === undefined, true);

  const throwingSend = makeBusSandbox({ throwOnSend: true });
  let b = 'untouched';
  let bCalled = false;
  throwingSend.bus.request('request:applySettings', {}, (x) => { bCalled = true; b = x; });
  eq('bus request: a tab send that throws answers undefined',
    bCalled && b === undefined, true);

  const noResponder = makeBusSandbox();
  let c = 'untouched';
  let cCalled = false;
  noResponder.bus.request('request:applySettings', {}, (x) => { cCalled = true; c = x; });
  eq('bus request: no responder registered answers undefined',
    cCalled && c === undefined, true);

  // A context with no chrome.tabs cannot send a request at all. The reason
  // request() answers undefined there sits above request() in app/bus.js.
  const noTabs = makeBusSandbox({ noTabs: true });
  let d = 'untouched';
  noTabs.bus.request('request:applySettings', {}, (x) => { d = x; });
  eq('bus request: a context with no chrome.tabs answers undefined', d, undefined);
})();

(function busRequestDeliversToOneContextOnly() {
  // The reason sits above request() in app/bus.js.
  const s = makeBusSandbox();
  let localRan = false;
  s.bus.subscribe('request:applySettings', () => { localRan = true; });
  s.bus.request('request:applySettings', {}, () => {});
  eq('bus request: a request does not deliver to same-context subscribers', localRan, false);

  // An arriving request with no responder in THIS context stays silent. The
  // reason sits in the onMessage listener in app/bus.js.
  const t = makeBusSandbox();
  let answered = false;
  t.fire({ topic: 'request:applySettings' }, { tab: { id: 1 } }, () => { answered = true; });
  eq('bus request: an arriving request with no local responder sends no reply',
    answered, false);
})();

(function busRequestExplicitTab() {
  // The sidebar passes the tab ID of its bound tab, so the bus sends its request
  // to that tab and runs no query for the tab in front.
  const s = makeBusSandbox({ reply: { ok: true } });
  let answer = null;
  s.bus.request('request:activeTable', {}, (x) => { answer = x; }, { tabId: 42 });
  eq('bus request: an explicit tab ID skips the active-tab lookup', s.sent.queries, 0);
  eq('bus request: and addresses the tab the caller named',
    s.sent.tabs.length === 1 ? s.sent.tabs[0].tabId : null, 42);
  eq('bus request: and hands the callback that tab\'s answer',
    answer ? answer.ok : null, true);

  // A null tab ID, as the sidebar holds before its tab lookup answers,
  // falls back to the lookup.
  const t = makeBusSandbox();
  t.bus.request('request:activeTable', {}, () => {}, { tabId: null });
  eq('bus request: a null tab ID falls back to the active-tab lookup',
    [t.sent.queries, t.sent.tabs.length === 1 ? t.sent.tabs[0].tabId : null], [1, 7]);
})();

(function busOneResponderPerTopic() {
  const s = makeBusSandbox();
  s.bus.respond('request:applySettings', () => 1);
  let threw = false;
  try { s.bus.respond('request:applySettings', () => 2); } catch (e) { threw = true; }
  eq('bus request: a second responder for one topic throws', threw, true);
})();

(function busRequestFamilyGuards() {
  const s = makeBusSandbox();
  let respondThrew = false;
  try { s.bus.respond('state:settingsChanged', () => 1); } catch (e) { respondThrew = true; }
  eq('bus request: respond on a non-request topic throws', respondThrew, true);

  let requestThrew = false;
  try { s.bus.request('state:settingsChanged', {}, () => {}); } catch (e) { requestThrew = true; }
  eq('bus request: request on a non-request topic throws', requestThrew, true);

  let unknownThrew = false;
  try { s.bus.respond('not:a:topic', () => 1); } catch (e) { unknownThrew = true; }
  eq('bus request: respond on an unknown topic throws', unknownThrew, true);
})();

(function busRequestFamilyImpliesTabRoute() {
  // A request addresses exactly one context. Any other route on a request
  // entry is a table mistake, and this fails closed on it.
  let allTabRouted = true;
  let requestCount = 0;
  for (const topic in DR_BUS.TOPICS) {
    const entry = DR_BUS.TOPICS[topic];
    if (entry.family !== 'request') continue;
    requestCount++;
    if (entry.route !== 'tab') allTabRouted = false;
  }
  eq('bus table: at least one request topic exists (fails closed on a lost table)',
    requestCount > 0, true);
  eq('bus table: every request-family topic carries route "tab"', allTabRouted, true);
})();

(function busDepthGuardCoversResponders() {
  // A responder runs on the same depth counter a subscriber does, so an
  // unguarded cycle reached through a responder becomes a clear error rather
  // than a real stack overflow.
  //
  // The cycle goes responder -> responder, never through publish(). A cycle
  // that passed through a subscriber would be caught by publish()'s own
  // counter, and this test would stay green with the listener's guard deleted.
  const s = makeBusSandbox();
  s.bus.respond('request:applySettings', () => {
    s.fire({ topic: 'request:applySettings' }, { tab: { id: 1 } }, () => {});
    return {};
  });
  let message = null;
  try {
    s.fire({ topic: 'request:applySettings' }, { tab: { id: 1 } }, () => {});
  } catch (e) {
    message = e.message;
  }
  eq('bus request: a responder-only request cycle throws a publish depth error',
    /depth exceeded/.test(message || ''), true);
  eq('bus request: the error says it happened while responding',
    /while responding to "request:applySettings"/.test(message || ''), true);

  // The counter unwinds on the way out, so a later publish on the SAME bus
  // behaves normally rather than still reading as deep. A fresh bus would
  // prove nothing here.
  let secondThrew = null;
  try {
    s.bus.publish('intent:activateTable', { table: null });
  } catch (e) {
    secondThrew = e.message;
  }
  eq('bus request: a publish after a responder cycle succeeds on the same bus',
    secondThrew, null);
})();

// --- The settings apply is a request, not a publish ---
//
// The sidebar never reads the reply's value, only whether anyone answered,
// and the bus serves that through its one reply path.
(function settingsApplyUsesRequestPath() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const contentSrc = sourceByName('content.js');

  eq('settings apply: the sidebar sends it through request()',
    /DR_BUS\.request\(\s*'request:applySettings'/.test(sidebarSrc), true);
  eq('settings apply: the sidebar does not publish it',
    /DR_BUS\.publish\(\s*'request:applySettings'/.test(sidebarSrc), false);
  eq('settings apply: the content script answers through respond()',
    /DR_BUS\.respond\(\s*'request:applySettings'/.test(contentSrc), true);

  // The unbind-on-no-answer rule is the load-bearing one. Drive it through the
  // bus rather than through the source text: an unanswered request must reach
  // the callback with nothing, which is what makes the sidebar unbind.
  const s = makeBusSandbox({ throwOnSend: true });
  let sawNothing = false;
  s.bus.request('request:applySettings', { settings: {} }, (answer) => {
    sawNothing = answer === undefined;
  });
  eq('settings apply: an unanswered apply reaches the publisher with nothing, which is what unbinds the sidebar',
    sawNothing, true);

  // And the answered case stays distinguishable from it.
  const t = makeBusSandbox({ reply: { ok: true } });
  let sawAnswer = false;
  t.bus.request('request:applySettings', { settings: {} }, (answer) => {
    sawAnswer = !!(answer && answer.ok);
  });
  eq('settings apply: an answered apply is distinguishable from an unanswered one',
    sawAnswer, true);
})();

// --- One mechanism, one topic list ---
//
// One delivery mechanism carries every cross-context topic. These pin the
// four facts that make that true, so a new raw send or a second listener
// fails here.
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

  for (const topic of ['request:activeTable', 'request:captureState']) {
    eq('one mechanism: the content script answers ' + topic,
      contentSrc.includes("respond('" + topic + "'"), true);
    eq('one mechanism: the sidebar requests ' + topic,
      sidebarSrc.includes("request('" + topic + "'"), true);
  }

  // Every topic name follows the bus's one naming style.
  let allNamed = true;
  for (const topic in DR_BUS.TOPICS) {
    if (!/^(intent|state|request):[a-z][A-Za-z]*$/.test(topic)) allNamed = false;
  }
  eq('one mechanism: every topic name follows the family:name style', allNamed, true);
})();

// --- A cross-context topic is deliverable inside the context that publishes it ---
//
// publish() hands the topic to same-context subscribers before it reaches the
// carrier. Every topic here crosses contexts, so one context publishing an
// intent or a request it also receives would run its own handler on the way
// out. No such topic pairs that way today, and this fails at the commit if
// one starts to. State-change topics stay out of the scan: the model publishes
// a state change, and every view redraws from it, including a view in the
// model's own context, such as the table pillbox.
(function noContextPublishesWhatItSubscribes() {
  // Keyed by context, not by file: the content script's context loads
  // table-pillbox-view.js and app/model.js into the same scope as content.js, so a
  // publish in one and a subscription in another is the same loopback.
  const SOURCES = {
    'the content script': [sourceByName('content.js'), sourceByName('table-pillbox-view.js'),
      sourceByName('app/model.js')].map((src) => src || '').join('\n'),
    'the sidebar': fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8'),
    'the service worker': fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8'),
  };
  const CROSSING = Object.keys(DR_BUS.TOPICS).filter((t) =>
    DR_BUS.TOPICS[t].route !== null && DR_BUS.TOPICS[t].family !== 'state-change');
  eq('one direction: the scan has cross-context topics to check (fails closed on an empty table)',
    CROSSING.length > 0, true);
  const bothEnds = [];
  const callsWith = (verb, topic) => new RegExp(verb + "\\(\\s*'" + topic + "'");
  for (const [context, src] of Object.entries(SOURCES)) {
    for (const topic of CROSSING) {
      const publishes = callsWith('publish', topic).test(src);
      const receives = callsWith('subscribe', topic).test(src) ||
        callsWith('respond', topic).test(src);
      if (publishes && receives) bothEnds.push(context + ' -> ' + topic);
    }
  }
  eq('one direction: no context both publishes and receives the same crossing intent or request',
    bothEnds, []);
})();
