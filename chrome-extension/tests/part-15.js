// ---------------------------------------------------------------------------
// The bus's topic table is the one declaration of every topic name.
//
// A name written out again at a call site is the defect the shared list was
// built to remove: one mistyped character produced a message no listener
// matched, with no error and no log row. The list retired into the bus's
// table, and the bus builds every wire message itself, so no context file
// needs a name of its own. These pin both halves.
// ---------------------------------------------------------------------------

(function theBusHoldsEveryTopicName() {
  const contextFiles = {
    'content.js': sourceByName('content.js') || '',
    'ui-toggle.js': uiToggleCode || '',
    'ui-toast.js': sourceByName('ui-toast.js') || '',
    'app/store.js': storeCode || '',
    'sidebar.js': fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8'),
    'background.js': fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8'),
  };

  // The bus is the only file that puts an action field on a message. A
  // context file writing one is reaching around the topic table.
  for (const [name, src] of Object.entries(contextFiles)) {
    const literals = (src.match(/action(?::|\s*===)\s*['"][A-Za-z][A-Za-z0-9_:]*['"]/g) || []);
    eq(`one topic list: ${name} builds no wire message of its own`, literals, []);
  }

  // Every name in the table is reachable: it appears in at least one context
  // file. A name left behind after its last use is clutter the next reader
  // has to rule out.
  const allContextSrc = Object.values(contextFiles).join('\n');
  const declared = Object.keys(DR_BUS.TOPICS);
  eq('one topic list: the scan has topics to check (fails closed on an empty table)',
    declared.length > 0, true);
  const unused = declared.filter((topic) => !allContextSrc.includes("'" + topic + "'"));
  eq('one topic list: every declared topic is used by at least one context file',
    unused, []);
})();

// ---------------------------------------------------------------------------
// Issue #325 — every cross-context topic on the event bus.
//
// A shared sandbox harness for the bus tests below. adapters/messaging.js has
// no DOM dependency, so it runs in its own vm context with only the Chrome
// interfaces stubbed. Each call builds a fresh bus, which matters: a responder
// registration and a subscription both outlive the test that made them, and
// the one-responder rule would make the second test in a file throw for the
// first test's registration.
//
// opts.noTabs        omit chrome.tabs entirely — the content-script context.
// opts.noActiveTab   chrome.tabs.query answers with no tabs.
// opts.throwOnSend   chrome.tabs.sendMessage throws, as it does when the tab
//                    holds no content script.
// opts.reply         the value chrome.tabs.sendMessage hands its callback.
// ---------------------------------------------------------------------------
function makeBusSandbox(opts) {
  const options = opts || {};
  const vm = require('vm');
  const sent = { pages: [], tabs: [], queries: 0 };
  let captured = null;
  const tabs = {
    query(q, cb) { sent.queries++; cb(options.noActiveTab ? [] : [{ id: 7 }]); },
    sendMessage(tabId, msg, cb) {
      sent.tabs.push({ tabId, msg });
      if (options.throwOnSend) throw new Error('no content script');
      if (cb) cb(options.reply);
    },
  };
  const sandbox = {
    chrome: {
      runtime: {
        lastError: null,
        sendMessage(msg, cb) { sent.pages.push(msg); if (cb) cb(undefined); },
        onMessage: { addListener(fn) { captured = fn; } },
      },
    },
  };
  if (!options.noTabs) sandbox.chrome.tabs = tabs;
  vm.createContext(sandbox);
  vm.runInContext(constantsCode + '\n' + messagingCode + '\nthis.__DR_BUS = DR_BUS;', sandbox);
  return {
    bus: sandbox.__DR_BUS,
    sent,
    // Call the bus's own onMessage listener the way Chrome would.
    fire(request, sender, sendResponse) {
      return captured(request, sender || {}, sendResponse || function () {});
    },
  };
}

// --- #325 Task 1: the topic table carries a route ---
(function busTableCarriesRoute() {
  const VALID_ROUTES = [null, 'extension-pages', 'tab'];
  let allHaveFamily = true;
  let allHaveValidRoute = true;
  let noWireAction = true;
  for (const topic in DR_BUS.TOPICS) {
    const entry = DR_BUS.TOPICS[topic];
    if (typeof entry.family !== 'string' || entry.family.length === 0) allHaveFamily = false;
    if (!Object.prototype.hasOwnProperty.call(entry, 'route')) { allHaveValidRoute = false; }
    else if (VALID_ROUTES.indexOf(entry.route) === -1) { allHaveValidRoute = false; }
    if (Object.prototype.hasOwnProperty.call(entry, 'wireAction')) noWireAction = false;
  }
  eq('bus table: every topic carries a non-empty family', allHaveFamily, true);
  eq('bus table: every topic carries a route drawn from the three valid values',
    allHaveValidRoute, true);
  eq('bus table: the table is not empty (fails closed on a lost table)',
    Object.keys(DR_BUS.TOPICS).length > 0, true);
  eq('bus table: no topic carries the retired wireAction field', noWireAction, true);
})();

// --- #325 Task 1: the route picks the carrier, not the publishing context ---
(function busRoutePicksCarrier() {
  // The old transport sniff inferred the carrier from which Chrome interface
  // the publishing context held. The route no longer lets it.

  // A tab-routed topic with no explicit tab number: the bus runs the active-tab
  // lookup the sidebar used to repeat before each of its own sends. The payload
  // here is the bus's contract under test, not the topic's production payload —
  // the menu click carries none.
  const b = makeBusSandbox();
  b.bus.publish('intent:menuClicked', { probe: 1 });
  eq('bus route: a tab topic queries the active tab once', b.sent.queries, 1);
  eq('bus route: and sends to that tab', b.sent.tabs.length, 1);
  eq('bus route: aimed at the tab the query answered with',
    b.sent.tabs.length === 1 ? b.sent.tabs[0].tabId : null, 7);
  eq('bus route: the topic name itself is the name on the wire',
    b.sent.tabs.length === 1 ? b.sent.tabs[0].msg.action : null, 'intent:menuClicked');
  eq('bus route: the message carries the payload beside the name, nothing else',
    b.sent.tabs.length === 1 ? Object.keys(b.sent.tabs[0].msg).sort().join(',') : null,
    'action,probe');

  // An explicit tab number skips the lookup. Only the service worker holds a
  // tab number, and it holds it for a tab that may not be the active one.
  const c = makeBusSandbox();
  c.bus.publish('intent:menuClicked', {}, { tabId: 42 });
  eq('bus route: an explicit tab number skips the active-tab lookup', c.sent.queries, 0);
  eq('bus route: and addresses the tab the caller named',
    c.sent.tabs.length === 1 ? c.sent.tabs[0].tabId : null, 42);

  // A tab-routed publish from a context with no chrome.tabs cannot reach its
  // audience. Returning quietly would reproduce the silent miss the topic
  // table exists to remove.
  const d = makeBusSandbox({ noTabs: true });
  let threw = false;
  try { d.bus.publish('intent:menuClicked', {}); } catch (e) { threw = true; }
  eq('bus route: a tab topic published where chrome.tabs is absent throws', threw, true);

  // The extension-pages route takes the other carrier: the broadcast that
  // reaches the service worker and the open sidebar, and never a content
  // script. It needs no tab number, so it runs no active-tab lookup.
  const f = makeBusSandbox();
  f.bus.publish('intent:closeSidebar', {});
  eq('bus route: an extension-pages topic broadcasts once', f.sent.pages.length, 1);
  eq('bus route: and sends into no tab', f.sent.tabs.length, 0);
  eq('bus route: and runs no active-tab lookup', f.sent.queries, 0);
  eq('bus route: the broadcast carries the topic name on the wire',
    f.sent.pages.length === 1 ? f.sent.pages[0].action : null, 'intent:closeSidebar');

  // An extension-pages publish from a context with no chrome.tabs reaches its
  // audience: that carrier needs none. This is the case the sniff got wrong —
  // it read the absent interface as a reason to pick the other carrier.
  const g = makeBusSandbox({ noTabs: true });
  g.bus.publish('state:pageUnloaded', {});
  eq('bus route: an extension-pages topic sends from a context with no chrome.tabs',
    g.sent.pages.length, 1);

  // A same-context topic sends nothing either way.
  const e = makeBusSandbox();
  e.bus.publish('intent:selectTable', { table: null });
  eq('bus route: a route-less topic makes no wire send',
    e.sent.pages.length + e.sent.tabs.length, 0);
})();

// --- #340: publish() refuses a request topic rather than dropping its answer ---
//
// The ask refuses a topic recorded one-way and the answering registration
// refuses a topic recorded as a question. The one-way send had no matching
// refusal: handed a question it sent the message, the responder answered, and
// the answer went nowhere, with nothing logged and nothing failed.
(function busPublishRefusesRequestTopic() {
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

  // The two siblings, unchanged: each of the three pairings now refuses.
  const b = makeBusSandbox();
  let askThrew = false;
  try { b.bus.request('intent:menuClicked', {}, () => {}); } catch (e) { askThrew = true; }
  eq('one-way guard: request() still refuses a one-way topic', askThrew, true);
  let respondThrew = false;
  try { b.bus.respond('intent:menuClicked', () => {}); } catch (e) { respondThrew = true; }
  eq('one-way guard: respond() still refuses a one-way topic', respondThrew, true);
})();

// --- #325 Task 2: a subscriber learns the sending tab ---
//
// The service worker's page-unload handler reads the sending tab's number off
// Chrome's sender record and acts only when that tab is the one the sidebar
// was opened for. The bus handed subscribers the payload alone, and a payload
// cannot carry the number — a content script does not hold its own. Without
// this argument, moving that topic onto the bus would close the sidebar on a
// page unload in any tab.
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
  b.fire({ action: 'state:settingsChanged', settings: {} }, { tab: { id: 77 } });
  eq('bus meta: a wire message from a content script reports its tab number',
    fromTab.length === 1 && fromTab[0].tabId === 77, true);

  const c = makeBusSandbox();
  const fromPage = [];
  c.bus.subscribe('state:settingsChanged', (payload, meta) => { fromPage.push(meta); });
  c.fire({ action: 'state:settingsChanged', settings: {} }, {});
  eq('bus meta: a wire message from an extension page reports no tab number',
    fromPage.length === 1 && fromPage[0].tabId === null, true);

  // The payload stays exactly what the publisher sent. The tab number rides
  // beside it, never inside it, so no handler can mistake it for data the
  // publisher chose.
  const d = makeBusSandbox();
  let seenPayload = null;
  d.bus.subscribe('state:settingsChanged', (payload) => { seenPayload = payload; });
  d.fire({ action: 'state:settingsChanged', settings: { k: 1 } }, { tab: { id: 5 } });
  eq('bus meta: the tab number stays out of the payload',
    seenPayload === null ? null : Object.keys(seenPayload).sort().join(','), 'settings');
})();

// --- #325 Task 3: request and respond ---
(function busRequestReplyRoundTrip() {
  // The asking side: the answer chrome hands back reaches the callback.
  const a = makeBusSandbox({ reply: { settings: { k: 9 } } });
  let answer = 'untouched';
  a.bus.request('request:applySettings', { settings: {} }, (x) => { answer = x; });
  eq('bus request: the answer reaches the asker',
    answer && answer.settings ? answer.settings.k : null, 9);

  // The answering side: a responder's return value goes to Chrome's reply
  // callback, unwrapped.
  const b = makeBusSandbox();
  b.bus.respond('request:applySettings', (payload) => ({ echoed: payload.n }));
  let replied = 'untouched';
  b.fire({ action: 'request:applySettings', n: 5 }, { tab: { id: 3 } }, (r) => { replied = r; });
  eq('bus request: the responder\'s return value is what the asker receives',
    replied && replied.echoed, 5);

  // A responder reads the carrier's facts the same way a subscriber does.
  const c = makeBusSandbox();
  let responderMeta = null;
  c.bus.respond('request:applySettings', (payload, meta) => { responderMeta = meta; return {}; });
  c.fire({ action: 'request:applySettings' }, { tab: { id: 11 } }, () => {});
  eq('bus request: a responder receives the sending tab too',
    responderMeta ? responderMeta.tabId : null, 11);
})();

(function busRequestAbsentResponder() {
  // Three ways nothing answers. Each must reach the callback with undefined,
  // immediately — the sidebar's fallback to shipped defaults and to the
  // unbound state has always depended on the absence arriving at once, with no
  // waiting period.
  const noTab = makeBusSandbox({ noActiveTab: true });
  let a = 'untouched';
  let aCalled = false;
  noTab.bus.request('request:applySettings', {}, (x) => { aCalled = true; a = x; });
  eq('bus request: no active tab answers undefined', aCalled && a === undefined, true);

  const noScript = makeBusSandbox({ throwOnSend: true });
  let b = 'untouched';
  let bCalled = false;
  noScript.bus.request('request:applySettings', {}, (x) => { bCalled = true; b = x; });
  eq('bus request: no content script on the tab answers undefined',
    bCalled && b === undefined, true);

  const noResponder = makeBusSandbox();
  let c = 'untouched';
  let cCalled = false;
  noResponder.bus.request('request:applySettings', {}, (x) => { cCalled = true; c = x; });
  eq('bus request: no responder registered answers undefined',
    cCalled && c === undefined, true);

  // A context with no chrome.tabs cannot ask at all. publish() throws there,
  // because a lost one-way message is a silent miss; request() answers
  // undefined instead, because the asker already handles an unanswered ask and
  // that is exactly what this is.
  const noTabs = makeBusSandbox({ noTabs: true });
  let d = 'untouched';
  noTabs.bus.request('request:applySettings', {}, (x) => { d = x; });
  eq('bus request: a context with no chrome.tabs answers undefined', d, undefined);
})();

(function busRequestDeliversToOneContextOnly() {
  // A request addresses exactly one context, the tab's, so it never runs the
  // publishing context's own subscribers the way publish() does.
  const s = makeBusSandbox();
  let localRan = false;
  s.bus.subscribe('request:applySettings', () => { localRan = true; });
  s.bus.request('request:applySettings', {}, () => {});
  eq('bus request: a request does not deliver to same-context subscribers', localRan, false);

  // An arriving request with no responder in THIS context stays silent.
  // Answering undefined would close the asker's callback on behalf of a
  // context holding no answer.
  const t = makeBusSandbox();
  let answered = false;
  t.fire({ action: 'request:applySettings' }, { tab: { id: 1 } }, () => { answered = true; });
  eq('bus request: an arriving request with no local responder sends no reply',
    answered, false);
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
    s.fire({ action: 'request:applySettings' }, { tab: { id: 1 } }, () => {});
    return {};
  });
  let message = null;
  try {
    s.fire({ action: 'request:applySettings' }, { tab: { id: 1 } }, () => {});
  } catch (e) {
    message = e.message;
  }
  eq('bus request: the depth guard covers a cycle that runs only through responders',
    /depth exceeded/.test(message || ''), true);
  eq('bus request: the error says it happened while responding',
    /while responding to "request:applySettings"/.test(message || ''), true);

  // The counter unwinds on the way out, so a later publish on the SAME bus
  // behaves normally rather than still reading as deep. A fresh bus would
  // prove nothing here.
  let secondThrew = null;
  try {
    s.bus.publish('intent:selectTable', { table: null });
  } catch (e) {
    secondThrew = e.message;
  }
  eq('bus request: the depth counter recovers on the same bus after a responder cycle',
    secondThrew, null);
})();

// --- #325 Task 5: the settings apply is a request, not a publish ---
//
// It always carried a reply. The sidebar never read the reply's value, only
// whether anyone answered, and the bus served that through a second reply
// shape — a delivery-outcome callback beside the answer path. Two reply shapes
// in one component is the clutter issue #325 exists to remove.
(function settingsApplyUsesRequestPath() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const contentSrc = sourceByName('content.js');
  const busSrc = sourceByName('adapters/messaging.js');

  eq('settings apply: the sidebar asks through request()',
    /DR_BUS\.request\(\s*'request:applySettings'/.test(sidebarSrc), true);
  eq('settings apply: the sidebar no longer publishes it one-way',
    /DR_BUS\.publish\(\s*'request:applySettings'/.test(sidebarSrc), false);
  eq('settings apply: the content script answers through respond()',
    /DR_BUS\.respond\(\s*'request:applySettings'/.test(contentSrc), true);
  eq('settings apply: the delivery-outcome callback retires from the bus',
    busSrc.includes('onDelivery'), false);
  eq('settings apply: the sidebar keeps no delivery-outcome callback',
    sidebarSrc.includes('onDelivery'), false);

  // The unbind-on-no-answer rule is the load-bearing one. Drive it through the
  // bus rather than through the source text: an unanswered request must reach
  // the callback with nothing, which is what makes the sidebar unbind.
  const s = makeBusSandbox({ throwOnSend: true });
  let sawNothing = false;
  s.bus.request('request:applySettings', { settings: {} }, (answer) => {
    sawNothing = answer === undefined;
  });
  eq('settings apply: an unanswered apply reaches the asker with nothing, which is what unbinds the sidebar',
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


// --- #325 Task 9: the content script publishes through the bus ---
(function contentPublishesThroughBus() {
  const contentSrc = sourceByName('content.js');
  eq('content on bus: no raw chrome.runtime.sendMessage call',
    contentSrc.includes('chrome.runtime.sendMessage'), false);
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
  eq('content on bus: the one delivery of the on/off report is this publish',
    contentSrc.split("publish('state:tableEnabledChanged'").length - 1, 1);
})();


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

// --- #325 Task 12: one mechanism, one topic list ---
//
// The end state of the move. Two delivery mechanisms carried the eighteen
// cross-context topics; one carries all of them now. These pin the four facts
// that make that true, so a new raw send or a second listener fails here
// rather than reintroducing the split.
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
  eq('one mechanism: the table holds all eighteen cross-context topics plus the five same-context ones',
    Object.keys(DR_BUS.TOPICS).length, 23);
})();

// --- #325 Task 12: the moved responders answer through the bus ---
//
// The preview-samples branch carries a rule the source assertions above
// cannot see: with no table selected it answers a pair of nulls rather than
// nothing, because the sidebar reads a null samples field as the unbound
// state. This drives the content script's own bus listener the way Chrome
// does, in an isolated eval so the shared-scope model stays untouched.
(function movedRespondersAnswerThroughTheBus() {
  const capturedListeners = [];
  function fire(message) {
    let answer;
    for (const fn of capturedListeners) fn(message, {}, (r) => { answer = r; });
    return answer;
  }

  const saved = { chrome: global.chrome, document: global.document, window: global.window };
  global.chrome = {
    runtime: {
      onMessage: { addListener(fn) { capturedListeners.push(fn); } },
      sendMessage: () => {},
      lastError: null,
    },
  };
  global.document = {
    addEventListener: () => {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: { appendChild: () => {}, observe: () => {} },
  };
  global.window = {
    addEventListener: () => {},
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
  };
  try {
    eval(contentScriptBundle);
  } catch (e) {
    // Module-level code may fail in the stub environment; the bus's listener
    // registers before any dynamic code runs.
  } finally {
    global.chrome = saved.chrome;
    global.document = saved.document;
    global.window = saved.window;
  }

  eq('moved responders: the bus listener was captured', capturedListeners.length, 1);
  if (capturedListeners.length === 0) return;

  // Nothing has been right-clicked in this isolated model.
  eq('moved responders: no selected table answers a pair of nulls, not nothing',
    fire({ action: 'request:previewSamples' }), { samples: null, maxMag: null });

  const captureAnswer = fire({ action: 'request:captureState' });
  eq('moved responders: the capture state answers an object',
    captureAnswer !== null && typeof captureAnswer === 'object', true);

  const settingsAnswer = fire({ action: 'request:settings' });
  eq('moved responders: the settings answer carries the model\'s record',
    !!(settingsAnswer && settingsAnswer.settings), true);
})();

// --- #325: a moved topic is deliverable inside the context that publishes it ---
//
// publish() hands the topic to same-context subscribers before it reaches the
// carrier. Every topic here crosses contexts, so one context publishing a topic
// it also subscribes to would run its own handler on the way out — a delivery
// the old inline listeners could not make, because a context never received its
// own send. No topic pairs that way today, and this fails at the commit if one
// starts to.
(function noContextPublishesWhatItSubscribes() {
  // Keyed by context, not by file: the content script's context loads
  // ui-toggle.js and app/store.js into the same scope as content.js, so a
  // publish in one and a subscription in another is the same loopback.
  const SOURCES = {
    'the content script': [sourceByName('content.js'), sourceByName('ui-toggle.js'),
      sourceByName('app/store.js')].map((src) => src || '').join('\n'),
    'the sidebar': fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8'),
    'the service worker': fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8'),
  };
  const CROSSING = Object.keys(DR_BUS.TOPICS).filter((t) => DR_BUS.TOPICS[t].route !== null);
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
  eq('one direction: no context both publishes and receives the same crossing topic',
    bothEnds, []);
})();


// --- The sidebar serves one tab (issue #343) --------------------------------
//
// A content script reports by broadcast, and a broadcast reaches the sidebar
// whatever tab it came from. The sidebar acted on every report it received,
// so a background tab re-simplifying its rows redrew the sidebar and a
// blocked apply there locked it against a table the user could not see.
//
// createBoundTab holds the whole concern and takes its tabs interface and its
// bus as parameters, so this section drives the real source with stubs
// instead of scanning it.
(function boundTabSection() {
  const sidebarSrc = fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8');
  const factory = sidebarSrc.match(/function createBoundTab\([\s\S]*?\n\}/);

  eq('bound tab: createBoundTab extracted from sidebar.js', !!factory, true);
  if (!factory) return;

  const createBoundTab = (new Function('return ' + factory[0] + ';'))();
  eq('bound tab: createBoundTab is a function', typeof createBoundTab, 'function');

  // A bus stub recording every subscription, so a test can deliver a report
  // on a topic with any sending tab it likes.
  function makeBus() {
    const handlers = new Map();
    return {
      subscribe(topic, handler) {
        if (!handlers.has(topic)) handlers.set(topic, []);
        handlers.get(topic).push(handler);
        return () => {};
      },
      // Deliver as the bus does: the payload, and beside it the facts the
      // carrier supplied rather than the publisher.
      deliver(topic, payload, tabId) {
        for (const h of (handlers.get(topic) || [])) h(payload, { tabId });
      },
      topicCount() { return handlers.size; },
    };
  }

  // A tabs stub. queryResult is what chrome.tabs.query answers with. An
  // activation names a window, and defaults to the window the bound tab sits
  // in, so a test that names none is switching tabs inside that window.
  function makeTabs(queryResult) {
    const listeners = [];
    const homeWindow = queryResult && queryResult[0] ? queryResult[0].windowId : undefined;
    return {
      query(q, cb) { cb(queryResult); },
      onActivated: { addListener: (fn) => { listeners.push(fn); } },
      activate(tabId, windowId) {
        const inWindow = windowId === undefined ? homeWindow : windowId;
        for (const fn of listeners) fn({ tabId, windowId: inWindow });
      },
      listenerCount() { return listeners.length; },
    };
  }

  const OWN_TAB = 11;
  const OTHER_TAB = 12;
  const OWN_WINDOW = 3;
  const OTHER_WINDOW = 4;

  // --- The opening read runs after the tab is recorded, never before ---
  (function resolveOrdering() {
    const order = [];
    const tabs = {
      query(q, cb) { order.push('query'); cb([{ id: OWN_TAB, windowId: OWN_WINDOW }]); },
      onActivated: { addListener: () => {} },
    };
    const bus = makeBus();
    const boundTab = createBoundTab(tabs, bus);
    const seen = [];
    boundTab.subscribe('state:applyOk', () => { seen.push('report'); });
    boundTab.resolve(() => { order.push('opening read'); });

    eq('bound tab: the opening read runs after the tab lookup',
      order, ['query', 'opening read']);

    // The recorded tab is read through the only thing that uses it.
    bus.deliver('state:applyOk', {}, OWN_TAB);
    eq('bound tab: resolve records the tab the sidebar was opened for',
      seen, ['report']);
  })();

  // --- The window the bound tab sits in, for the screenshot ---
  (function windowIdAccessor() {
    const boundTab = createBoundTab(makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]), makeBus());
    const before = boundTab.windowId();
    boundTab.resolve(() => {});
    eq('bound tab: windowId() answers null before the lookup and the window after it',
      [before, boundTab.windowId()], [null, OWN_WINDOW]);
    const noWindow = createBoundTab({ query: (q, cb) => cb([{ id: OWN_TAB }]) }, makeBus());
    noWindow.resolve(() => {});
    eq('bound tab: windowId() stays null when the tabs interface reports no window',
      noWindow.windowId(), null);
  })();

  // No tab to bind to: the sidebar still runs its opening read, which falls
  // to the unbound state on its own when nothing answers.
  (function resolveWithNoActiveTab() {
    const bus = makeBus();
    const boundTab = createBoundTab(makeTabs([]), bus);
    const seen = [];
    boundTab.subscribe('state:applyOk', () => { seen.push('report'); });
    let ran = false;
    boundTab.resolve(() => { ran = true; });

    eq('bound tab: no active tab still runs the opening read', ran, true);

    bus.deliver('state:applyOk', {}, OWN_TAB);
    eq('bound tab: with no tab recorded every report is dropped', seen, []);
  })();

  // --- A report is acted on only when it came from the bound tab ---
  (function reportsAreFiltered() {
    const bus = makeBus();
    const boundTab = createBoundTab(makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]), bus);
    boundTab.resolve(() => {});

    const seen = [];
    boundTab.subscribe('state:applyBlocked', (payload) => { seen.push(payload); });

    bus.deliver('state:applyBlocked', { from: 'own' }, OWN_TAB);
    eq('bound tab: a report from the bound tab reaches its handler',
      seen, [{ from: 'own' }]);

    bus.deliver('state:applyBlocked', { from: 'other' }, OTHER_TAB);
    eq('bound tab: a report from another tab is dropped',
      seen, [{ from: 'own' }]);

    // An extension page has no tab. Nothing a content script sends looks
    // like this, and a report that does belongs to no tab at all.
    bus.deliver('state:applyBlocked', { from: 'an extension page' }, null);
    eq('bound tab: a report carrying no tab is dropped',
      seen, [{ from: 'own' }]);
  })();

  // The window between the sidebar opening and its tab lookup answering.
  // Nothing can be compared yet, so nothing is acted on; the opening read
  // that follows carries the current truth.
  (function reportsBeforeTheTabResolves() {
    const bus = makeBus();
    const boundTab = createBoundTab(makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]), bus);
    const seen = [];
    boundTab.subscribe('state:previewSamplesChanged', (payload) => { seen.push(payload); });

    bus.deliver('state:previewSamplesChanged', { early: true }, OWN_TAB);
    eq('bound tab: a report arriving before the tab lookup answers is dropped',
      seen, []);

    boundTab.resolve(() => {});
    bus.deliver('state:previewSamplesChanged', { early: false }, OWN_TAB);
    eq('bound tab: reports are acted on once the tab lookup has answered',
      seen, [{ early: false }]);
  })();

  // --- Leaving the bound tab ---
  //
  // The service worker closes the sidebar when the tab it was opened for
  // stops being the front tab, and misses two routes: an idle restart empties
  // the tab number it compares against, and a sidebar opened from Chrome's
  // own side-panel control never sets it. On those routes the sidebar used to
  // survive the switch and keep showing controls for a page the user had
  // left. It closes itself now, so a tab switch has one outcome.
  (function closesOnSwitchAway() {
    const tabs = makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]);
    const boundTab = createBoundTab(tabs, makeBus());
    boundTab.resolve(() => {});

    let closes = 0;
    boundTab.onSwitchAway(() => { closes++; });

    tabs.activate(OWN_TAB);
    eq('bound tab: staying on the bound tab does not close the sidebar', closes, 0);

    tabs.activate(OTHER_TAB);
    eq('bound tab: switching to another tab closes the sidebar', closes, 1);
  })();

  // A side panel belongs to one browser window, and the activation event
  // fires for every window. An activation in a second window leaves the bound
  // tab where it was — still the front tab of its own window — so closing on
  // it would take the sidebar away from a user who never left its page.
  (function activationInAnotherWindow() {
    const tabs = makeTabs([{ id: OWN_TAB, windowId: OWN_WINDOW }]);
    const boundTab = createBoundTab(tabs, makeBus());
    boundTab.resolve(() => {});

    let closes = 0;
    boundTab.onSwitchAway(() => { closes++; });

    tabs.activate(OTHER_TAB, OTHER_WINDOW);
    eq('bound tab: an activation in another window does not close the sidebar', closes, 0);

    tabs.activate(OTHER_TAB, OWN_WINDOW);
    eq('bound tab: an activation in the bound tab\'s own window closes it', closes, 1);
  })();

  // With no tab recorded there is nothing to have left, and closing on the
  // next switch would take the sidebar away for a reason it cannot state.
  (function noBoundTabNeverCloses() {
    const tabs = makeTabs([]);
    const boundTab = createBoundTab(tabs, makeBus());
    boundTab.resolve(() => {});

    let closes = 0;
    boundTab.onSwitchAway(() => { closes++; });

    tabs.activate(OTHER_TAB);
    eq('bound tab: with no tab recorded a switch does not close the sidebar', closes, 0);
  })();

  // A tabs interface with no activation event must not throw. The sidebar
  // then never closes itself, which is its behavior before this change.
  (function noActivationEvent() {
    const bus = makeBus();
    const boundTab = createBoundTab({ query: (q, cb) => cb([{ id: OWN_TAB }]) }, bus);
    boundTab.resolve(() => {});

    let threw = false;
    try { boundTab.onSwitchAway(() => {}); } catch (e) { threw = true; }
    eq('bound tab: a tabs interface with no activation event does not throw', threw, false);

    // Reports still reach the sidebar; only the self-close is missing.
    const seen = [];
    boundTab.subscribe('state:applyOk', () => { seen.push('report'); });
    bus.deliver('state:applyOk', {}, OWN_TAB);
    eq('bound tab: reports still reach the sidebar with no activation event',
      seen, ['report']);
  })();

  // --- Every content-script report goes through the gate ---
  //
  // The list is derived, never restated: a topic qualifies when the bus lists
  // it, the content script publishes it, and the sidebar subscribes it. A
  // topic added later joins this check with no edit here. The count assertion
  // makes the scan fail closed, so a regex that matches nothing cannot read
  // as a pass.
  (function everyContentReportIsGated() {
    const contentSrc = sourceByName('content.js');
    eq('bound tab: the content script source is readable (fails closed on a rename)',
      typeof contentSrc, 'string');
    if (typeof contentSrc !== 'string') return;
    const publishes = (src, topic) => new RegExp("publish\\(\\s*'" + topic + "'").test(src);
    const gated = (src, topic) => new RegExp("boundTab\\.subscribe\\(\\s*'" + topic + "'").test(src);
    const ungated = (src, topic) => new RegExp("DR_BUS\\.subscribe\\(\\s*'" + topic + "'").test(src);

    const contentReports = Object.keys(DR_BUS.TOPICS).filter((topic) =>
      publishes(contentSrc, topic) && (gated(sidebarSrc, topic) || ungated(sidebarSrc, topic)));

    eq('bound tab: the scan found content-script reports the sidebar subscribes (fails closed on an empty list)',
      contentReports.length > 0, true);
    eq('bound tab: every content-script report the sidebar subscribes goes through the bound-tab gate',
      contentReports.filter((topic) => ungated(sidebarSrc, topic)), []);

    // The service worker's close carries no tab, so gating it would drop it.
    eq('bound tab: the close message stays off the gate',
      ungated(sidebarSrc, 'intent:closeSidebar'), true);
  })();
})();

// --- The sidebar's one-tab rule, driven end to end (issue #343) -------------
//
// The section above drives the unit directly, so it passes whether or not the
// sidebar ever calls it. This one evaluates the whole sidebar against stubs,
// captures the message listener and the activation listener it registers, and
// drives a report and a tab switch through the real path.
(function boundTabWiringSection() {
  const roundingSrc = sourceByName('lib/dr-number/rounding.js');
  const coreSrc = sourceByName('lib/dr-number/core.js');
  if (constantsCode === null || roundingSrc === null || coreSrc === null || messagingCode === null) {
    eq('bound tab wiring: source files present in manifest', false, true);
    return;
  }

  const BOUND_TAB = 21;
  const OTHER_TAB = 22;
  const BOUND_WINDOW = 5;

  function makeEl() {
    return {
      addEventListener() {}, removeEventListener() {},
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      style: {}, value: '', checked: false, disabled: false, textContent: '', innerHTML: '',
      appendChild() {}, querySelector() { return makeEl(); }, querySelectorAll() { return []; },
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
      matches() { return false; }, closest() { return null; }, dataset: {},
      setAttribute() {}, removeAttribute() {},
    };
  }

  const statusEl = makeEl();
  const bodyClasses = new Set();
  const captureBody = {
    classList: {
      add(cls) { bodyClasses.add(cls); },
      remove(cls) { bodyClasses.delete(cls); },
      contains(cls) { return bodyClasses.has(cls); },
      toggle(cls, force) {
        if (force === undefined) {
          if (bodyClasses.has(cls)) bodyClasses.delete(cls); else bodyClasses.add(cls);
        } else if (force) bodyClasses.add(cls); else bodyClasses.delete(cls);
      },
    },
    addEventListener() {},
    get offsetWidth() { return 0; },
  };
  const captureDoc = {
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete',
    body: captureBody,
    getElementById(id) { return id === 'status' ? statusEl : makeEl(); },
    createElement() { return makeEl(); },
  };

  let activationListener = null;
  let messageListener = null;
  let pendingLookup = null;
  let queryCalls = 0;
  const settingsReads = [];
  const captureChrome = {
    runtime: {
      onMessage: { addListener(fn) { messageListener = fn; } },
      sendMessage() {},
      lastError: null,
    },
    tabs: {
      // The sidebar's own tab lookup is the first query, and Chrome answers
      // it on a later task. Holding its answer here is what lets the
      // assertions below see the sidebar between opening and binding. Every
      // later query is the bus finding a tab for one of the sidebar's reads,
      // and answers at once.
      query(q, cb) {
        queryCalls++;
        if (queryCalls === 1) {
          pendingLookup = cb;
          return;
        }
        cb([{ id: BOUND_TAB, windowId: BOUND_WINDOW }]);
      },
      sendMessage(tabId, msg, cb) {
        if (msg.action === 'request:settings') {
          settingsReads.push(tabId);
          cb({ settings: Object.assign({}, DR_DEFAULTS) });
          return;
        }
        cb(undefined);
      },
      onActivated: { addListener(fn) { activationListener = fn; } },
    },
  };

  let closes = 0;
  const savedDoc = global.document;
  const savedChrome = global.chrome;
  const savedWindow = global.window;
  global.document = captureDoc;
  global.chrome = captureChrome;
  global.window = {
    addEventListener() {},
    close() { closes++; },
    getComputedStyle: () => ({ display: 'block' }),
  };

  let evalError = null;
  try {
    eval(
      constantsCode + '\n' +
      roundingSrc + '\n' +
      coreSrc + '\n' +
      messagingCode + '\n' +
      fs.readFileSync(path.join(__dirname, 'sidebar.js'), 'utf8')
    );
  } catch (e) {
    evalError = e;
  }

  try {
    eq('bound tab wiring: the sidebar evaluated without error',
      evalError === null ? 'none' : evalError.message, 'none');
    eq('bound tab wiring: the sidebar registered a message listener',
      typeof messageListener, 'function');
    if (typeof messageListener !== 'function') return;

    // Between opening and binding. Nothing may go out to a page yet: the
    // sidebar has no tab to compare an answer or a report against, and an
    // activation arriving now would have nothing to compare either.
    eq('bound tab wiring: the sidebar asked which tab it was opened for',
      queryCalls, 1);
    eq('bound tab wiring: no read goes out before the tab lookup answers',
      settingsReads, []);
    eq('bound tab wiring: no activation is watched before the tab lookup answers',
      activationListener, null);

    pendingLookup([{ id: BOUND_TAB, windowId: BOUND_WINDOW }]);

    eq('bound tab wiring: the opening read goes to the bound tab once the lookup answers',
      settingsReads, [BOUND_TAB]);
    eq('bound tab wiring: the sidebar registered an activation listener',
      typeof activationListener, 'function');
    if (typeof activationListener !== 'function') return;

    // A locked-table report from another tab must not reach the controls.
    // The lock is the loudest of the eight reports: it writes the status and
    // stops the sidebar accepting input.
    messageListener({ action: 'state:applyBlocked' }, { tab: { id: OTHER_TAB } }, () => {});
    eq('bound tab wiring: a lock reported by another tab does not lock the sidebar',
      bodyClasses.has('table-locked'), false);

    // The same report from the bound tab does reach them.
    messageListener({ action: 'state:applyBlocked' }, { tab: { id: BOUND_TAB } }, () => {});
    eq('bound tab wiring: a lock reported by the bound tab locks the sidebar',
      bodyClasses.has('table-locked'), true);

    // Switching to another tab in the sidebar's own window closes it.
    eq('bound tab wiring: the sidebar is open before any switch', closes, 0);
    activationListener({ tabId: OTHER_TAB, windowId: BOUND_WINDOW });
    eq('bound tab wiring: switching to another tab closes the sidebar', closes, 1);
  } finally {
    global.document = savedDoc;
    global.chrome = savedChrome;
    global.window = savedWindow;
  }
})();

