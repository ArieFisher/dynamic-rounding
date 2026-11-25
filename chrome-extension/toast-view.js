// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

/**
 * The toast view.
 *
 * Draws the newest extension error on the page. It subscribes to the error
 * state's state-change topic (state:errorRecorded, which the application
 * model publishes after every log row the controller records). Its variables
 * hold drawing state only: the element, its timer, and the stylesheet flag.
 *
 * The view never logs. If it logged, the controller would record the row in
 * the error state, the application model would publish that row to this view,
 * the view would log again, and the calls would repeat without end.
 *
 * Loaded after app/bus.js, because it subscribes at load, and before
 * content.js, so the subscription exists before content.js registers the row
 * listener that writes rows into the error state.
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
    clearTimeout(hideTimer);
    hideTimer = null;
    if (toastEl) toastEl.remove();
    toastEl = null;
  }

  function show(text) {
    ensureStyleInjected();
    // show reuses the one element, so the page holds one toast while a warning
    // repeats on every scroll.
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = TOAST_CLASS;
      // A status region: assistive technology announces the text without
      // moving focus.
      toastEl.setAttribute('role', 'status');
      toastEl.addEventListener('click', hide);
      (document.body || document.documentElement).appendChild(toastEl);
    }
    // The text goes in through textContent, so the page never parses a log
    // row's text as markup.
    toastEl.textContent = text;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, TOAST_HIDE_MS);
  }

  DR_BUS.subscribe('state:errorRecorded', ({ errorState }) => {
    show(errorState.rows.at(-1).text);
  });

  return { TOAST_CLASS, TOAST_HIDE_MS };
})();
