/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * DynamicRounding lib/dr-log package: the log buffer.
 *
 * DR_LOG holds the most recent rows the extension records in this context.
 * Each context evaluates this file separately — the content script loads it
 * from the manifest (directly after constants.js, so every later file can
 * log), the sidebar loads it from a script tag, the service worker imports it
 * — so each holds its own buffer, and a capture carries the content script's
 * and the sidebar's buffer copies, each labeled by its context.
 *
 * record() also writes each row's full text to the console, so devtools
 * output is unchanged. The buffer exists because a capture cannot read the
 * console: the rows it carries are exactly the ones recorded here.
 *
 * A buffer copy shows both the rows that remain and how many are gone. Row text
 * is cut to bound the capture's size.
 *
 * A warn or error row also carries the stack trace at the moment it was
 * recorded. Debug and info rows carry null: they are frequent, and a trace
 * costs a stack walk per row.
 *
 * A row listener receives a copy of each row after it lands.
 */

const DR_LOG = (function () {
  const ROW_LIMIT = 50;
  const TEXT_LIMIT = 2000;
  // The levels whose rows are extension errors. A row at one of these levels
  // carries a stack trace here and enters the application model's error state
  // in the controller, which reads this list rather than holding its own.
  const ERROR_LEVELS = ['warn', 'error'];
  const rows = [];
  const listeners = new Set();
  let dropped = 0;

  // V8's captureStackTrace leaves out every frame above the function it is
  // handed, so a trace taken against the log call starts at that call's
  // caller. The slice below drops the trace's header line ("Error") on both
  // branches, so only frames stay.
  function stackTraceFrom(logCall) {
    const holder = {};
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(holder, logCall);
    } else {
      holder.stack = new Error().stack;
    }
    const frames = String(holder.stack || '').split('\n').slice(1).join('\n');
    return frames.length > TEXT_LIMIT ? frames.slice(0, TEXT_LIMIT) : frames;
  }

  function copyRow(row) {
    return { at: row.at, level: row.level, text: row.text, stack: row.stack };
  }

  function record(level, text, logCall) {
    const asString = typeof text === 'string' ? text : String(text);
    const row = {
      at: new Date().toISOString(),
      level,
      text: asString.length > TEXT_LIMIT ? asString.slice(0, TEXT_LIMIT) : asString,
      stack: ERROR_LEVELS.includes(level) ? stackTraceFrom(logCall) : null,
    };
    rows.push(row);
    if (rows.length > ROW_LIMIT) {
      rows.shift();
      dropped++;
    }
    // Dynamic lookup, not a captured reference, so a console replaced later
    // (the test suite installs spies) still receives the full text.
    (console[level] || console.log).call(console, asString);
    for (const listener of Array.from(listeners)) {
      try {
        listener(copyRow(row));
      } catch (e) {
        // Straight to the console, never through record(): a listener that
        // throws on every row would otherwise recurse.
        console.error.call(console, 'Dynamic Rounding: a log row listener failed (' +
          String(e && e.message ? e.message : e) + ').');
      }
    }
  }

  // copyBuffer() returns fresh copies, so no caller can reach the buffer's own
  // rows through the result.
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

  // Named functions, because each hands itself to stackTraceFrom as the
  // frame the trace starts below.
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
