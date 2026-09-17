/**
 * DynamicRounding Chrome Extension
 * https://github.com/ArieFisher/dynamic-rounding
 * MIT License
 * Copyright (c) 2026 Arie Fisher
 */

/**
 * The toast view.
 *
 * Draws the newest error row on the page: one fixed element at the bottom
 * right holding the row's text, removed by a click or after the hide delay.
 * It subscribes to the model's error state change (state:errorRecorded,
 * published by app/store.js after every row the controller records) and
 * holds no application state of its own. The element and its timer are
 * drawing state, like the pillbox view's own map of buttons.
 *
 * One toast: a second row replaces the text and restarts the delay, so a
 * warning that repeats on every scroll shows one toast.
 *
 * The view never logs. A row it recorded would land in the error state and
 * publish back to this view, one level deeper on every turn.
 *
 * Loaded after ui-toggle.js and before content.js, so the subscription
 * exists before the controller registers the row listener that feeds it.
 */

const DR_TOAST = (function () {
  const TOAST_CLASS = 'dr-ext-toast';
  const TOAST_HIDE_MS = 5000;
  let toastEl = null;
  let hideTimer = null;
  let styleInjected = false;

  function ensureStyleInjected() {
    if (styleInjected) return;
    const style = document.createElement('style');
    style.textContent = `
      .${TOAST_CLASS} {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483646;
        max-width: min(420px, calc(100vw - 32px));
        padding: 10px 14px;
        border-radius: 6px;
        background: #3c3c3c;
        color: #ffffff;
        font: 13px/1.4 system-ui, sans-serif;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        overflow-wrap: anywhere;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    styleInjected = true;
  }

  function hide() {
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
    toastEl = null;
  }

  function show(text) {
    // No element factory means no page to draw on: a context evaluated
    // without a document, as the test suite's default stub is.
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    ensureStyleInjected();
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = TOAST_CLASS;
      // A status region: assistive technology announces the text without
      // moving focus. textContent, never markup, so a row's text is text.
      toastEl.setAttribute('role', 'status');
      toastEl.addEventListener('click', hide);
      (document.body || document.documentElement).appendChild(toastEl);
    }
    toastEl.textContent = text;
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, TOAST_HIDE_MS);
  }

  DR_BUS.subscribe('state:errorRecorded', ({ errorState }) => {
    const rows = errorState && Array.isArray(errorState.rows) ? errorState.rows : [];
    if (rows.length === 0) return;
    show(rows[rows.length - 1].text);
  });

  return { show, hide, TOAST_CLASS, TOAST_HIDE_MS };
})();
