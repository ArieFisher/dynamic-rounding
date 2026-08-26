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
 *
 * Loaded after the lib/ packages and before app/store.js — the store
 * publishes through this bus, so the bus must exist first.
 */

const DR_BUS = (function () {
  const INTENT = 'intent';
  const STATE_CHANGE = 'state-change';

  // The one place every topic name is enumerated. wireAction: null means the
  // topic is same-context only.
  const TOPICS = {
    'intent:selectTable': { family: INTENT, wireAction: null },
    'state:selectedTableChanged': { family: STATE_CHANGE, wireAction: null },
    'state:sidebarOpenChanged': { family: STATE_CHANGE, wireAction: null },
    // Published by the sidebar's controls (a different extension context
    // from the model) on every settings change. wireAction reuses
    // APPLY_SIDEBAR_SETTINGS, the message name content.js already handles,
    // so the wire format is unchanged — only the sender's code path is.
    'intent:settingsChanged': { family: INTENT, wireAction: 'APPLY_SIDEBAR_SETTINGS' },
    // Published by the model (app/store.js) after every settings change,
    // regardless of source. The controller subscribes to apply the new
    // value to the selected table — this is the bus's first state-change
    // subscriber (see the depth guard below, issue #240).
    'state:settingsChanged': { family: STATE_CHANGE, wireAction: null },
  };

  const subscribers = new Map(); // topic name -> Set<handler>
  const wireActionToTopic = new Map();
  for (const topic in TOPICS) {
    const wireAction = TOPICS[topic].wireAction;
    if (wireAction) wireActionToTopic.set(wireAction, topic);
  }

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

  // Deliver to same-context subscribers only. Used both by publish() below
  // and by the onMessage relay, so a redelivered incoming wire message never
  // triggers another outbound send.
  function deliverLocally(topic, payload) {
    const set = subscribers.get(topic);
    if (!set) return;
    for (const handler of Array.from(set)) {
      handler(payload);
    }
  }

  // A handler invoked by deliverLocally() may itself publish (directly, or
  // through a store setter) before returning — same-context delivery is
  // synchronous (see the header), so that nested publish() runs on top of
  // this one's still-live stack frame. A cycle with no caller-side guard
  // would recurse until the real call stack overflows (issue #240). This
  // cap allows any legitimate shallow chain (the deepest today, a guarded
  // two-topic bounce-back, reaches 4) while turning an unguarded cycle into
  // a clear, catchable error instead of a crash.
  const MAX_PUBLISH_DEPTH = 20;
  let publishDepth = 0;

  function publish(topic, payload) {
    assertKnownTopic(topic);
    publishDepth++;
    try {
      if (publishDepth > MAX_PUBLISH_DEPTH) {
        throw new Error(
          'DR_BUS: publish depth exceeded ' + MAX_PUBLISH_DEPTH +
          ' while publishing "' + topic + '" — likely an unguarded reentrant publish cycle'
        );
      }
      deliverLocally(topic, payload);
      const wireAction = TOPICS[topic].wireAction;
      if (!wireAction || typeof chrome === 'undefined' || !chrome.runtime) return;
      if (chrome.tabs && typeof chrome.tabs.query === 'function' && typeof chrome.tabs.sendMessage === 'function') {
        // Extension-page context (the sidebar): chrome.runtime.sendMessage
        // cannot reach a content script, so relay via the active tab —
        // the same transport sidebar.js already used for this call.
        try {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0]) return;
            try {
              chrome.tabs.sendMessage(tabs[0].id, Object.assign({ action: wireAction }, payload));
            } catch (e) {
              // no content script on this tab (or it hasn't loaded yet); harmless.
            }
          });
        } catch (e) {
          // extension context may not be available; harmless.
        }
      } else if (typeof chrome.runtime.sendMessage === 'function') {
        // Content-script context: broadcast to every extension page
        // (background, the open sidebar) — unchanged from before this topic.
        try {
          chrome.runtime.sendMessage(Object.assign({ action: wireAction }, payload));
        } catch (e) {
          // extension context may not be available; harmless.
        }
      }
    } finally {
      publishDepth--;
    }
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage &&
      typeof chrome.runtime.onMessage.addListener === 'function') {
    chrome.runtime.onMessage.addListener((request) => {
      if (!request || wireActionToTopic.size === 0) return;
      const topic = wireActionToTopic.get(request.action);
      if (!topic) return;
      const payload = Object.assign({}, request);
      delete payload.action;
      deliverLocally(topic, payload);
    });
  }

  return { publish, subscribe, TOPICS };
})();
