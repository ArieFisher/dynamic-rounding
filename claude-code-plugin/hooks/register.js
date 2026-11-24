// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

import { atom, read, update } from 'claude-code';

import { DR_DEFAULTS } from './library.js';
import { markdownTables } from './markdown-adapter.js';
import { simplifyTables } from './text-table.js';

// False at every session start: nothing stores the value across sessions.
const isOn = atom({ plugin: 'dynamic-rounding', key: 'isOn' }, false);

export const register = (on) => {
  // The command name is a literal here and in the `command.run` hook's
  // matcher: `claude plugin validate` reads both to list the hook as
  // answering its own command.
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'simplify-data',
      description: 'Simplify the numbers in markdown tables, on or off',
      immediate: true,
    });
    return next(e);
  });

  on('command.run', { command: 'simplify-data' }, async ($) => {
    const isNowOn = await update($, isOn, (value) => !value);
    const valueText = `simplify-data: ${isNowOn ? 'on' : 'off'}`;
    $.ui.status(isNowOn ? valueText : undefined);
    return { text: valueText };
  });

  // The hook reads the on/off value while the engine draws a reply block, so
  // the engine draws every reply block again when the value changes. No
  // failure handler: the engine skips this hook when it throws or runs past
  // its time limit, and draws the reply block as written.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e);
    const text = simplifyTables(e.props.text, markdownTables(e.props.text), DR_DEFAULTS);
    return next({ ...e, props: { ...e.props, text } });
  });
};
