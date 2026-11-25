// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * DynamicRounding lib/dr-log package: the log buffer.
 *
 * DR_LOG holds the most recent rows the extension records in this context.
 * Each context evaluates this file separately, so each holds its own buffer.
 * The content script loads it from the manifest, directly after constants.js,
 * so every later file can log. The sidebar loads it from a script tag, and the
 * service worker imports it. A capture carries the content script's and the
 * sidebar's buffer copies, each labeled by its context.
 *
 * record() also writes each row's full, uncut text to the console. The buffer
 * exists because nothing in a capture comes from the console: the rows a
 * capture carries are exactly the ones recorded here.
 *
 * Row text and stack traces are cut to bound the capture's size.
 *
 * A row listener receives a copy of each row after it is recorded. The
 * application model and the event bus load after this module, so the
 * controller reads each row through a listener rather than this module
 * calling them.
 */

const DR_LOG = (function () {
  const ROW_LIMIT = 50;
  const TEXT_LIMIT = 2000;
  // The levels whose rows are extension errors. A row at one of these levels
  // carries a stack trace, and the controller records it in the application
  // model's error state. The controller reads this list rather than holding
  // its own. Debug and info rows carry no stack trace: they are frequent, and
  // a trace costs a stack walk per row.
  const ERROR_LEVELS = ['warn', 'error'];
  const rows = [];
  const listeners = new Set();
  let dropped = 0;

  function cutToLimit(text) {
    return text.length > TEXT_LIMIT ? text.slice(0, TEXT_LIMIT) : text;
  }

  // V8's captureStackTrace leaves out every frame above the function it is
  // handed, so a trace taken against the log call starts at that call's
  // caller. The slice below drops the trace's header line ("Error"), so only
  // frames stay.
  function stackTraceFrom(logCall) {
    const holder = {};
    Error.captureStackTrace(holder, logCall);
    return cutToLimit(String(holder.stack).split('\n').slice(1).join('\n'));
  }

  function copyRow(row) {
    return { at: row.at, level: row.level, text: row.text, stack: row.stack };
  }

  function record(level, text, logCall) {
    const asString = String(text);
    const row = {
      at: new Date().toISOString(),
      level,
      text: cutToLimit(asString),
      stack: ERROR_LEVELS.includes(level) ? stackTraceFrom(logCall) : null,
    };
    rows.push(row);
    if (rows.length > ROW_LIMIT) {
      rows.shift();
      dropped++;
    }
    // Dynamic lookup, not a captured reference, so a console replaced later
    // (the test suite installs spies) still receives the full text.
    console[level](asString);
    for (const listener of Array.from(listeners)) {
      try {
        listener(copyRow(row));
      } catch (e) {
        // Straight to the console, never through record(): a listener that
        // throws on every row would otherwise recurse.
        console.error('Dynamic Rounding: a log row listener failed (' +
          String(e && e.message ? e.message : e) + ').');
      }
    }
  }

  function copyBuffer() {
    return {
      rows: rows.map(copyRow),
      dropped,
      limit: ROW_LIMIT,
    };
  }

  function onRow(listener) {
    listeners.add(listener);
    return function offRow() {
      listeners.delete(listener);
    };
  }

  // warn and error pass themselves to record() as the frame the stack trace
  // starts below. debug and info pass themselves only so the four calls match.
  function debug(text) { record('debug', text, debug); }
  function info(text) { record('info', text, info); }
  function warn(text) { record('warn', text, warn); }
  function error(text) { record('error', text, error); }

  // A caller passes the event name in lower case, in the vocabulary's terms.
  function formatRow(event, fields) {
    const parts = ['Dynamic Rounding: ' + event];
    for (const [label, value] of Object.entries(fields || {})) {
      if (value === null || value === undefined || value === '') continue;
      parts.push(label + ': ' + (typeof value === 'number' ? value.toLocaleString('en-US') : value));
    }
    return parts.join(' · ');
  }

  // A row never holds the browser's message, which can carry page text.
  function errorType(thrown) {
    return thrown instanceof Error ? thrown.name : null;
  }

  // Calls record() rather than warn(), so the stack trace starts at this
  // function's caller and not at this function.
  function warnError(step, thrown) {
    record('warn', formatRow('error', { step, error: errorType(thrown) }), warnError);
  }

  return {
    debug, info, warn, error, copyBuffer, onRow, formatRow, errorType, warnError,
    ERROR_LEVELS: ERROR_LEVELS.slice(),
  };
})();
