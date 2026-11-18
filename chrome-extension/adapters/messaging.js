/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * Typed event bus over Chrome messaging.
 *
 * Every topic in DR_BUS.TOPICS carries a family and a route. The family
 * records the kind of message. The route records which carrier reaches the
 * topic's audience. Three families:
 *
 *   - 'intent'       A gesture: the user did something. The publisher only
 *                     publishes it. The controller, the one subscriber to
 *                     intent topics, determines what changes.
 *   - 'state-change' A fact: the application model, a tab, or the sidebar
 *                     changed. The component that made or detected the
 *                     change publishes it after the change.
 *   - 'request'      A question: the topic's one responder returns an answer
 *                     to the publisher.
 *
 * Three routes:
 *
 *   - null              Same context only. publish() sends nothing to
 *                        another context.
 *   - 'extension-pages' chrome.runtime.sendMessage, reaching the service
 *                        worker and the open sidebar. Chrome never delivers
 *                        that call to a content script.
 *   - 'tab'             chrome.tabs.sendMessage, reaching one tab's content
 *                        script.
 *
 * The bus keeps no state: no last-value cache, no history. A subscriber that
 * attaches after a publish never receives it, so a view that opens or
 * reconnects reads the current value from the application model.
 *
 * All three contexts load this file. In the content script it loads after the
 * lib/ packages and before app/model.js, because the application model
 * publishes through the bus. The service worker imports it at the top of
 * background.js, and the sidebar page loads it before sidebar.js.
 */

const DR_BUS = (function () {
  const INTENT = 'intent';
  const STATE_CHANGE = 'state-change';

  const REQUEST = 'request';

  const ROUTE_EXTENSION_PAGES = 'extension-pages';
  const ROUTE_TAB = 'tab';

  const TOPICS = {
    'intent:activateTable': { family: INTENT, route: null },
    'intent:toggleTable': { family: INTENT, route: null },
    // The sidebar reads the error state through request:captureState, so
    // this topic needs no route.
    'state:errorRecorded': { family: STATE_CHANGE, route: null },
    // The sidebar's requests. The content script holds the application model.
    'request:applySettings': { family: REQUEST, route: ROUTE_TAB },
    'request:activeTable': { family: REQUEST, route: ROUTE_TAB },
    'request:captureState': { family: REQUEST, route: ROUTE_TAB },
    // The service worker's one topic.
    'intent:menuClicked': { family: INTENT, route: ROUTE_TAB },
    // The content script's topics for the sidebar. The content script has no
    // chrome.tabs, and the sidebar is an extension page.
    'state:settingsChanged': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
    'state:tableActivated': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
    'state:tableSwitched': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
    'state:rangeError': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
    'state:rangeOk': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
    'state:previewSamplesChanged': { family: STATE_CHANGE, route: ROUTE_EXTENSION_PAGES },
  };

  const subscribers = new Map(); // topic name -> Set<handler>

  function isKnownTopic(topic) {
    return Object.prototype.hasOwnProperty.call(TOPICS, topic);
  }

  function assertKnownTopic(topic) {
    if (!isKnownTopic(topic)) {
      throw new Error('DR_BUS: unknown topic "' + topic + '"');
    }
  }

  const TOPIC_FIELD = 'topic';

  function encodeMessage(topic, payload) {
    return Object.assign({ [TOPIC_FIELD]: topic }, payload);
  }

  function decodeMessage(message) {
    if (!message || typeof message[TOPIC_FIELD] !== 'string') return null;
    const payload = Object.assign({}, message);
    delete payload[TOPIC_FIELD];
    return { topic: message[TOPIC_FIELD], payload };
  }

  function subscribe(topic, handler) {
    assertKnownTopic(topic);
    if (!subscribers.has(topic)) subscribers.set(topic, new Set());
    subscribers.get(topic).add(handler);
    return function unsubscribe() {
      const set = subscribers.get(topic);
      if (set) set.delete(handler);
    };
  }

  // Chrome attaches a sender record to every arriving message. The bus passes
  // on one fact from it, the tab ID of the tab a content script sent from,
  // and keeps the rest of Chrome's record out of its own contract.
  // The sidebar compares it with its bound tab's tab ID. A message from
  // an extension page has no tab, so this function returns null, and
  // publish() passes null for a same-context publish.
  function senderTabId(sender) {
    return sender && sender.tab && typeof sender.tab.id === 'number' ? sender.tab.id : null;
  }

  // Same-context subscribers only, so the onMessage listener can redeliver an
  // arriving message without sending it out again.
  //
  // Delivery is synchronous: every handler runs, in subscription order,
  // before publish() returns.
  //
  // meta.tabId travels beside the payload, never inside it, so no handler can
  // mistake it for data the publisher supplied.
  function deliverLocally(topic, payload, tabId) {
    const set = subscribers.get(topic);
    if (!set) return;
    const meta = { tabId };
    for (const handler of Array.from(set)) {
      handler(payload, meta);
    }
  }

  // A handler may publish again before it returns, so publish() recurses.
  // A cycle with no caller-side guard would recurse until the real call stack
  // overflows. The cap sits far above any chain the extension publishes
  // today, and turns an unguarded cycle into a clear, catchable error instead
  // of a crash.
  const MAX_PUBLISH_DEPTH = 20;
  let publishDepth = 0;

  /**
   * @param {string} action - The words the error text puts before the topic
   *   name, e.g. 'publishing'.
   */
  function withDepthGuard(action, topic, deliver) {
    publishDepth++;
    try {
      if (publishDepth > MAX_PUBLISH_DEPTH) {
        throw new Error(
          'DR_BUS: publish depth exceeded ' + MAX_PUBLISH_DEPTH +
          ' while ' + action + ' "' + topic + '" — likely an unguarded reentrant publish cycle'
        );
      }
      deliver();
    } finally {
      publishDepth--;
    }
  }

  function relay(topic, payload, route, opts) {
    if (route === ROUTE_EXTENSION_PAGES) {
      sendToExtensionPages(encodeMessage(topic, payload));
      return;
    }
    sendToTab(topic, payload, opts, null);
  }

  function sendToExtensionPages(message) {
    if (typeof chrome.runtime.sendMessage !== 'function') return;
    try {
      chrome.runtime.sendMessage(message, () => {
        // Read lastError only to consume it: with no extension page open
        // there is no receiver, and an unread lastError logs Chrome's
        // "Unchecked runtime.lastError" warning.
        void chrome.runtime.lastError;
      });
    } catch (e) {
      // extension context may not be available; harmless.
    }
  }

  // A tab-routed send needs a tab ID. A caller holding one passes it as
  // opts.tabId: the service worker does, for the right-clicked tab, and the
  // sidebar does, for its bound tab. Otherwise the bus
  // queries the tab in front of the current window.
  //
  // onReply, when given, receives the responder's answer, or undefined on
  // every failure path after the chrome.tabs check.
  function sendToTab(topic, payload, opts, onReply) {
    if (!chrome.tabs || typeof chrome.tabs.sendMessage !== 'function' ||
        typeof chrome.tabs.query !== 'function') {
      // A tab-routed topic published from a context with no chrome.tabs (a
      // content script) cannot reach its audience. Returning quietly here
      // would reproduce the silent miss the topic table exists to remove.
      throw new Error('DR_BUS: tab-routed topic "' + topic +
        '" published from a context with no chrome.tabs');
    }
    const message = encodeMessage(topic, payload);
    const deliver = (tabId) => {
      try {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          // Read lastError on one-way publishes too, not only on requests.
          void chrome.runtime.lastError;
          if (onReply) onReply(response);
        });
      } catch (e) {
        // Chrome reports a failed connection to the tab through lastError in
        // the callback above. This catch covers a synchronous throw from the
        // call itself.
        if (onReply) onReply(undefined);
      }
    };
    const explicitTabId = opts && typeof opts.tabId === 'number' ? opts.tabId : null;
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
      // extension context may not be available; harmless.
      if (onReply) onReply(undefined);
    }
  }

  function publish(topic, payload, opts) {
    assertKnownTopic(topic);
    if (TOPICS[topic].family === REQUEST) {
      throw new Error('DR_BUS: publish() cannot carry a request topic; "' +
        topic + '" is answered, and publish() discards the answer — use request()');
    }
    withDepthGuard('publishing', topic, () => {
      deliverLocally(topic, payload, null);
      const route = TOPICS[topic].route;
      if (!route || typeof chrome === 'undefined' || !chrome.runtime) return;
      relay(topic, payload, route, opts);
    });
  }

  // A request topic has exactly one responder, in exactly one context. A
  // second registration throws where it is made, rather than later when two
  // answers race.
  //
  // A responder returns its answer synchronously. Every responder in the
  // extension does, and an asynchronous one needs a design that does not
  // exist yet.
  const responders = new Map();

  function assertRequestFamily(topic, verb) {
    if (TOPICS[topic].family !== REQUEST) {
      throw new Error('DR_BUS: ' + verb + '() needs a request topic; "' +
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
  }

  // A request addresses exactly one context, the tab's, so it never delivers
  // to same-context subscribers the way publish() does.
  //
  // The callback receives the responder's answer, or undefined when nothing
  // answered: no tab, no content script on it, or no responder registered
  // there. The absence arrives immediately, with no waiting period. The
  // sidebar falls back to the shipped defaults and to the unbound state on
  // that absence.
  //
  // In a context with no chrome.tabs, request() passes undefined to the
  // callback rather than throwing the way a tab-routed publish does. A lost
  // one-way publish is a silent miss; an unanswered request is a case every
  // publisher already handles.
  function request(topic, payload, callback, opts) {
    assertKnownTopic(topic);
    assertRequestFamily(topic, 'request');
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.tabs ||
        typeof chrome.tabs.sendMessage !== 'function' ||
        typeof chrome.tabs.query !== 'function') {
      callback(undefined);
      return;
    }
    sendToTab(topic, payload, opts, callback);
  }

  // The one Chrome message listener in each context. No other file registers
  // one.
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage &&
      typeof chrome.runtime.onMessage.addListener === 'function') {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const decoded = decodeMessage(message);
      if (!decoded || !isKnownTopic(decoded.topic)) return;
      const { topic, payload } = decoded;
      const tabId = senderTabId(sender);
      if (TOPICS[topic].family !== REQUEST) {
        deliverLocally(topic, payload, tabId);
        return;
      }
      const responder = responders.get(topic);
      // No responder in THIS context: stay silent. Answering undefined would
      // close the publisher's callback on behalf of a context holding no
      // answer.
      if (!responder) return;
      // The responder counts as one level of the publish depth, so a publish
      // nested under it counts from there. The one-way branch above counts no
      // level: a publish from a subscriber it reaches starts at depth 1.
      withDepthGuard('responding to', topic, () => {
        sendResponse(responder(payload, { tabId }));
      });
    });
  }

  return { publish, subscribe, request, respond, TOPICS };
})();
