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
 */

const DR_LOG = (function () {
  const ROW_LIMIT = 50;
  const TEXT_LIMIT = 2000;
  const entries = [];
  let dropped = 0;

  function record(level, text) {
    const asString = typeof text === 'string' ? text : String(text);
    entries.push({
      at: new Date().toISOString(),
      level,
      text: asString.length > TEXT_LIMIT ? asString.slice(0, TEXT_LIMIT) : asString,
    });
    if (entries.length > ROW_LIMIT) {
      entries.shift();
      dropped++;
    }
    // Dynamic lookup, not a captured reference, so a console replaced later
    // (the test suite installs spies) still receives the row.
    (console[level] || console.log).call(console, asString);
  }

  // snapshot() returns fresh copies: the capture serializes what it gets,
  // and no caller can reach the buffer's own rows through the result.
  function snapshot() {
    return {
      entries: entries.map((e) => ({ at: e.at, level: e.level, text: e.text })),
      dropped,
      limit: ROW_LIMIT,
    };
  }

  return {
    debug(text) { record('debug', text); },
    info(text) { record('info', text); },
    warn(text) { record('warn', text); },
    error(text) { record('error', text); },
    snapshot,
  };
})();
