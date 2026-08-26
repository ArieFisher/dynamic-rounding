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
 *   - 'intent'       Published by views (e.g. ui-toggle.js) to report a user
 *                     action. The controller in content.js is the sole
 *                     subscriber. Every intent topic this sprint stays
 *                     inside the content-script scope: the view and its
 *                     controller share one JS context, so intent delivery
 *                     never needs chrome.runtime.
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
 *   - A topic MAY also carry a wireAction: the name of an existing
 *     chrome.runtime message action that sidebar.js/background.js already
 *     understand. When present, publish() additionally relays the payload
 *     as that action's message over chrome.runtime.sendMessage, so a
 *     cross-context subscriber keeps seeing the wire format it always has —
 *     no topic uses this yet (every topic this sprint stays same-context);
 *     the mechanism exists so a future topic can adopt an existing wire
 *     action instead of inventing a second, competing message shape.
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

  function publish(topic, payload) {
    assertKnownTopic(topic);
    deliverLocally(topic, payload);
    const wireAction = TOPICS[topic].wireAction;
    if (wireAction && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage(Object.assign({ action: wireAction }, payload));
      } catch (e) {
        // extension context may not be available; harmless.
      }
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
