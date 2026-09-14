/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * Typed event bus over Chrome messaging.
 *
 * Every topic in DR_BUS.TOPICS carries a family and a route. The family says
 * what kind of message it is; the route says which carrier reaches its
 * audience. Three families:
 *
 *   - 'intent'       A gesture: someone did a thing, and a controller decides
 *                     what changes. Published by a view — the pillbox in
 *                     ui-toggle.js, the sidebar page, the right-click menu
 *                     item — and never carrying authority of its own.
 *   - 'state-change' A fact: a field of the application model changed.
 *                     Published by app/store.js after the write. A subscriber
 *                     redraws on it, or reads the model's getters directly
 *                     when it only needs the current value.
 *   - 'request'      A question: the topic's one responder returns an answer
 *                     to the asker. See the request rules below.
 *
 * Three routes:
 *
 *   - null              Same context only. publish() sends nothing on the wire.
 *   - 'extension-pages' chrome.runtime.sendMessage, reaching the service
 *                        worker and the open sidebar. It cannot reach a
 *                        content script — that is chrome.runtime.sendMessage's
 *                        own contract.
 *   - 'tab'             chrome.tabs.sendMessage, reaching one tab's content
 *                        script. The tab number comes from opts.tabId when the
 *                        caller passes one, and otherwise from a query for the
 *                        active tab. Only the service worker passes one, for
 *                        the menu-click tab and the sidebar's tab, neither
 *                        guaranteed to be the active one.
 *
 * The route replaced a capability sniff: publish() used to test which Chrome
 * interface existed in the publishing context and infer the carrier from that,
 * so a topic whose audience did not match the inference had no way to say so.
 * A tab-routed publish from a context with no chrome.tabs now throws, rather
 * than reaching the wrong audience in silence.
 *
 * Delivery rules:
 *   - A state-change publish always carries the field's whole new value,
 *     never a delta — a subscriber never has to reconstruct state from a
 *     sequence of partial updates.
 *   - The bus keeps no state of its own: no last-value cache, no history.
 *     A subscriber that attaches after a publish never sees that publish.
 *     A view that opens or reconnects (the sidebar re-opening, most
 *     notably) must pull the current value from the model instead (see
 *     app/store.js) rather than rely on a message it may have missed while
 *     it was gone.
 *   - Same-context delivery is synchronous: publish() calls every matching
 *     handler directly, in subscription order, before returning. A
 *     controller that calls a store setter in response to a subscribed
 *     intent sees the store already updated by the time publish() returns.
 *     Because delivery is synchronous, a handler that itself publishes
 *     (directly, or by way of a store setter) can re-enter publish() before
 *     the original call returns; see the depth guard below.
 *   - publish() delivers to same-context subscribers first, then sends over
 *     the topic's route. A subscriber receives the payload and, beside it, a
 *     second argument holding what the carrier supplied rather than the
 *     publisher: meta.tabId, the sending tab's number. It is null for a
 *     same-context publish and for a message from an extension page, neither
 *     of which has a tab. It rides beside the payload, never inside it, so no
 *     handler can mistake it for data the publisher chose to send.
 *   - An arriving message whose action names a known topic is redelivered here
 *     as a same-context publish, without sending it back out, so a topic that
 *     crossed contexts behaves the same as one that did not from a
 *     subscriber's point of view. The topic name itself is the name on the
 *     wire; there is no second naming style.
 *
 * Request rules:
 *   - request(topic, payload, callback) asks, and respond(topic, handler)
 *     answers. A request addresses exactly one context, the tab's, so it never
 *     delivers to same-context subscribers the way publish() does.
 *   - The callback receives the responder's answer, or undefined when nothing
 *     answered: no tab, no content script on it, or no responder registered
 *     there. The absence arrives immediately, with no waiting period. The
 *     sidebar's fallback to shipped defaults and to the unbound state rests on
 *     that, so the bus consumes chrome.runtime.lastError itself and Chrome
 *     logs no "Unchecked runtime.lastError" warning.
 *   - A responder returns its answer synchronously. Every responder in the
 *     extension is synchronous, and the contract covers only that; an
 *     asynchronous one needs a design that does not exist yet.
 *   - One responder per topic. A second registration throws where it is made,
 *     rather than later when two answers race.
 *   - An arriving request with no responder in this context sends no reply.
 *     Answering undefined would close the asker's callback on behalf of a
 *     context holding no answer.
 *
 * Each context registers exactly one Chrome message listener, this file's.
 *
 * Loaded after the lib/ packages and before app/store.js — the store
 * publishes through this bus, so the bus must exist first. The service worker
 * loads it through importScripts.
 */

const DR_BUS = (function () {
  const INTENT = 'intent';
  const STATE_CHANGE = 'state-change';

  const REQUEST = 'request';

  // A topic's route states which carrier reaches its audience. It names no
  // subscriber, so publishers and subscribers stay unreferenced to each other.
  //   null              same-context only; publish sends nothing on the wire
  //   'extension-pages' chrome.runtime.sendMessage — the service worker and
  //                     the open sidebar
  //   'tab'             chrome.tabs.sendMessage — one tab's content script
  const ROUTE_EXTENSION_PAGES = 'extension-pages';
  const ROUTE_TAB = 'tab';

  // The one place every topic name is enumerated.
  const TOPICS = {
    'intent:selectTable': { family: INTENT, route: null },
    'intent:toggleTable': { family: INTENT, route: null },
    'state:selectedTableChanged': { family: STATE_CHANGE, route: null },
    // Published by the model (app/store.js) after every settings change,
    // regardless of source. The controller subscribes to apply the new
    // value to the selected table — this is the bus's first state-change
    // subscriber (see the depth guard below, issue #240).
    'state:settingsChanged': { family: STATE_CHANGE, route: null },
    // The sidebar's settings apply. A request rather than a one-way publish:
    // the content script records the settings and answers, and the sidebar
    // reads whether anyone answered at all to decide bound versus unbound.
    // The answer's value is never read.
    'request:applySettings': { family: REQUEST, route: ROUTE_TAB },
  };

  const subscribers = new Map(); // topic name -> Set<handler>

  function assertKnownTopic(topic) {
    if (!Object.prototype.hasOwnProperty.call(TOPICS, topic)) {
      throw new Error('DR_BUS: unknown topic "' + topic + '"');
    }
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

  // Chrome attaches a sender record to every arriving message. One fact off it
  // is load-bearing: which tab a content script sent from, which the service
  // worker checks against the tab the sidebar was opened for. The bus passes
  // that one number and keeps Chrome's record out of its own contract. A
  // same-context publish reports null, and so does a message from an extension
  // page — neither has a tab.
  function senderTabId(sender) {
    return sender && sender.tab && typeof sender.tab.id === 'number' ? sender.tab.id : null;
  }

  // Deliver to same-context subscribers only. Used both by publish() below
  // and by the onMessage relay, so a redelivered incoming wire message never
  // triggers another outbound send.
  //
  // A handler receives the payload and, beside it, the facts the carrier
  // supplied rather than the publisher: meta.tabId. It rides beside the
  // payload, never inside it, so no handler can mistake it for data the
  // publisher chose to send.
  function deliverLocally(topic, payload, tabId) {
    const set = subscribers.get(topic);
    if (!set) return;
    const meta = { tabId: typeof tabId === 'number' ? tabId : null };
    for (const handler of Array.from(set)) {
      handler(payload, meta);
    }
  }

  // A handler invoked by deliverLocally() may itself publish (directly, or
  // through a store setter) before returning — same-context delivery is
  // synchronous (see the header), so that nested publish() runs on top of
  // this one's still-live stack frame. A cycle with no caller-side guard
  // would recurse until the real call stack overflows (issue #240). This
  // cap allows any legitimate shallow chain (the deepest in production, the
  // intent:selectTable -> state:selectedTableChanged hop, reaches 2; a
  // guarded two-topic bounce-back reaches 4, but only in the reentrancy
  // test) while turning an unguarded cycle into a clear, catchable error
  // instead of a crash.
  const MAX_PUBLISH_DEPTH = 20;
  let publishDepth = 0;

  // The route determines the carrier. Before this, publish() tested which
  // Chrome interface existed in the publishing context and inferred the
  // carrier from that, so a topic whose audience did not match the inference
  // had no way to say so.
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
  // opts.tabId where it holds one — only the service worker does, for the
  // menu-click tab and the sidebar's tab, neither guaranteed to be active.
  // Otherwise the bus queries the active tab, which is the lookup the sidebar
  // repeated before each of its own sends.
  //
  // onReply, when given, receives the responder's answer, or undefined when
  // nothing answered: no tab, no content script on it, or no responder
  // registered there. The absence arrives immediately, with no waiting period.
  function sendToTab(message, opts, onReply) {
    if (!chrome.tabs || typeof chrome.tabs.sendMessage !== 'function' ||
        typeof chrome.tabs.query !== 'function') {
      // A tab-routed topic published from a context with no chrome.tabs (a
      // content script) cannot reach its audience. Returning quietly here
      // would reproduce the silent miss the topic table exists to remove.
      throw new Error('DR_BUS: tab-routed topic "' + message.action +
        '" published from a context with no chrome.tabs');
    }
    const deliver = (tabId) => {
      try {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          // Always touch lastError, even on a one-way publish nobody is
          // waiting on: otherwise a failed delivery logs Chrome's "Unchecked
          // runtime.lastError" warning. The bus reads it to consume it, and an
          // asker learns of a failure as an answer of undefined.
          void chrome.runtime.lastError;
          if (onReply) onReply(response);
        });
      } catch (e) {
        // no content script on this tab (or it has not loaded yet); harmless.
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
    publishDepth++;
    try {
      if (publishDepth > MAX_PUBLISH_DEPTH) {
        throw new Error(
          'DR_BUS: publish depth exceeded ' + MAX_PUBLISH_DEPTH +
          ' while publishing "' + topic + '" — likely an unguarded reentrant publish cycle'
        );
      }
      deliverLocally(topic, payload, null);
      const route = TOPICS[topic].route;
      if (!route || typeof chrome === 'undefined' || !chrome.runtime) return;
      relay(topic, payload, route, opts);
    } finally {
      publishDepth--;
    }
  }

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
  // to same-context subscribers the way publish() does.
  //
  // The callback receives the responder's answer, or undefined when nothing
  // answered: no tab, no content script on it, or no responder registered
  // there. The absence arrives immediately, with no waiting period, which is
  // what drives the sidebar's fallback to shipped defaults and to the unbound
  // state.
  //
  // A context with no chrome.tabs answers undefined rather than throwing the
  // way a tab-routed publish does. A lost one-way publish is a silent miss;
  // an unanswered request is a case every asker already handles.
  function request(topic, payload, callback) {
    assertKnownTopic(topic);
    assertRequestFamily(topic, 'request');
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.tabs ||
        typeof chrome.tabs.sendMessage !== 'function' ||
        typeof chrome.tabs.query !== 'function') {
      callback(undefined);
      return;
    }
    sendToTab(Object.assign({ action: topic }, payload), null, callback);
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage &&
      typeof chrome.runtime.onMessage.addListener === 'function') {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (!request || typeof request.action !== 'string') return;
      const topic = request.action;
      if (!Object.prototype.hasOwnProperty.call(TOPICS, topic)) return;
      const payload = Object.assign({}, request);
      delete payload.action;
      const tabId = senderTabId(sender);
      if (TOPICS[topic].family !== REQUEST) {
        deliverLocally(topic, payload, tabId);
        return;
      }
      const responder = responders.get(topic);
      // No responder in THIS context: stay silent. Answering undefined would
      // close the asker's callback on behalf of a context holding no answer.
      if (!responder) return;
      // A responder runs on the same depth counter a subscriber does, so a
      // publish nested under one cannot slip past the guard.
      publishDepth++;
      try {
        if (publishDepth > MAX_PUBLISH_DEPTH) {
          throw new Error(
            'DR_BUS: publish depth exceeded ' + MAX_PUBLISH_DEPTH +
            ' while responding to "' + topic + '" — likely an unguarded reentrant publish cycle'
          );
        }
        sendResponse(responder(payload, { tabId }));
      } finally {
        publishDepth--;
      }
    });
  }

  return { publish, subscribe, request, respond, TOPICS };
})();
