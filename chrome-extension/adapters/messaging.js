/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * Typed event bus over chrome.runtime messaging.
 *
 * Two topic families, and only two — every topic in DR_BUS.TOPICS carries
 * one of these two family tags:
 *
 *   - 'intent'       Published by views (e.g. ui-toggle.js, sidebar.js) to
 *                     report a user action. The controller in content.js is
 *                     the sole subscriber. Most intent topics stay inside
 *                     the content-script scope (the view and its controller
 *                     share one JS context, so delivery never needs
 *                     chrome.runtime) — but a view running in a different
 *                     extension context (the sidebar is its own page, not
 *                     part of the tab's content script) carries a wireAction
 *                     so the same publish() call reaches the controller
 *                     across contexts too.
 *   - 'state-change' Published by the model (app/store.js) whenever a
 *                     stored field changes. A view subscribes to redraw on
 *                     future changes, or simply reads the store's getters
 *                     directly when it only needs the current value.
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
 *   - A topic MAY also carry a wireAction: the name of an existing
 *     chrome.runtime message action that sidebar.js/background.js/content.js
 *     already understand. When present, publish() additionally relays the
 *     payload as that action's message, over whichever transport reaches
 *     the OTHER context from the one currently publishing:
 *       - From a content script, chrome.runtime.sendMessage() reaches every
 *         extension page (background, the open sidebar) — it cannot reach a
 *         content script (chrome.runtime.sendMessage's own contract).
 *       - From an extension page (the sidebar), chrome.tabs is available
 *         and chrome.runtime.sendMessage cannot reach a content script at
 *         all, so the relay instead queries the active tab and uses
 *         chrome.tabs.sendMessage — the exact transport sidebar.js already
 *         used for its content-script calls before this topic existed.
 *     Symmetrically, an incoming chrome.runtime message whose action
 *     matches a registered wireAction is redelivered here as a same-context
 *     publish (without re-sending it back out), so a cross-context topic
 *     behaves the same as a same-context one from a subscriber's point of
 *     view.
 *   - publish() takes an optional third argument, opts. On the extension-
 *     page relay branch (chrome.tabs.sendMessage), opts.onDelivery, when a
 *     function, is invoked after delivery settles — this is how a caller
 *     (e.g. sidebar.js) reacts to a delivery outcome (chrome.runtime.
 *     lastError on failure) the exact way sendToActiveTab did before this
 *     topic existed. The bus always supplies chrome.tabs.sendMessage its own
 *     callback and touches chrome.runtime.lastError inside it — regardless
 *     of whether the caller passed onDelivery — so a failed delivery never
 *     logs Chrome's "Unchecked runtime.lastError" warning. The bus itself
 *     stays generic: it forwards the outcome, but never inspects it or knows
 *     what a caller does with it.
 *
 * Loaded after the lib/ packages and before app/store.js — the store
 * publishes through this bus, so the bus must exist first.
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
    // the content script answers, and the sidebar reads whether anyone
    // answered at all to decide bound versus unbound. The answer's value is
    // never read. Until the sidebar moves onto request(), publish() serves it
    // through opts.onDelivery, which reaches the same callback.
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
    const onDelivery = opts && typeof opts.onDelivery === 'function' ? opts.onDelivery : null;
    const deliver = (tabId) => {
      try {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          // Always touch lastError, whatever the caller asked for: otherwise a
          // failed delivery logs Chrome's "Unchecked runtime.lastError"
          // warning. The bus reads it to consume it; interpreting a failure is
          // the caller's job.
          void chrome.runtime.lastError;
          if (onReply) onReply(response);
          if (onDelivery) onDelivery();
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
