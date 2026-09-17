/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * DynamicRounding lib/dr-log package: the log buffer.
 *
 * DR_LOG holds the last 50 rows the extension records in this context. Each
 * context evaluates this file separately — the content script loads it from
 * the manifest (directly after constants.js, so every later file can log),
 * the sidebar loads it from a script tag — so each holds its own buffer, and
 * a capture carries each buffer's snapshot labeled by its context.
 *
 * Every row also forwards to the real console, so devtools output is
 * unchanged. The buffer exists because a capture cannot read the console:
 * the rows it carries are exactly the ones recorded here.
 *
 * Rows past the cap drop off the front and are counted, so a snapshot shows
 * both what remains and how much is gone. Row text is cut at 2000 characters
 * to bound the capture's size.
 *
 * A warn or error row also carries the stack trace at the moment it was
 * recorded, starting at the caller of the level method — the same trace the
 * extension error page shows. Debug and info rows carry null: they are
 * frequent, and a trace costs a stack walk per row. The trace is cut at the
 * same bound as row text.
 *
 * A row listener receives a copy of each row after it lands. This is how the
 * controller learns of a row without this module reaching up to the
 * application model or the bus, both of which load after it. A listener that
 * throws is reported on the console and stops nothing: the row is already in
 * the buffer, and the other listeners still run.
 */

const DR_LOG = (function () {
  const ROW_LIMIT = 50;
  const TEXT_LIMIT = 2000;
  const TRACED_LEVELS = ['warn', 'error'];
  const entries = [];
  const listeners = new Set();
  let dropped = 0;

  // V8's captureStackTrace leaves out every frame above the function it is
  // handed, so a trace taken against the level method starts at that
  // method's caller. Its header line ("Error") goes too; only frames stay.
  function stackTraceFrom(levelMethod) {
    const holder = {};
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(holder, levelMethod);
    } else {
      holder.stack = new Error().stack;
    }
    const frames = String(holder.stack || '').split('\n').slice(1).join('\n');
    return frames.length > TEXT_LIMIT ? frames.slice(0, TEXT_LIMIT) : frames;
  }

  function copyRow(row) {
    return { at: row.at, level: row.level, text: row.text, stack: row.stack };
  }

  function record(level, text, levelMethod) {
    const asString = typeof text === 'string' ? text : String(text);
    const row = {
      at: new Date().toISOString(),
      level,
      text: asString.length > TEXT_LIMIT ? asString.slice(0, TEXT_LIMIT) : asString,
      stack: TRACED_LEVELS.includes(level) ? stackTraceFrom(levelMethod) : null,
    };
    entries.push(row);
    if (entries.length > ROW_LIMIT) {
      entries.shift();
      dropped++;
    }
    // Dynamic lookup, not a captured reference, so a console replaced later
    // (the test suite installs spies) still receives the row.
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

  // snapshot() returns fresh copies: the capture serializes what it gets,
  // and no caller can reach the buffer's own rows through the result.
  function snapshot() {
    return {
      entries: entries.map(copyRow),
      dropped,
      limit: ROW_LIMIT,
    };
  }

  // Registers a listener and returns the function that removes it.
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

  return { debug, info, warn, error, snapshot, onRow };
})();
