// Copyright (c) 2026 Arie Fisher | SPDX-License-Identifier: MIT

// The hooks module: the toggle command, the status entry, and the drawing
// hook. The engine keeps each reply block's originals, so the plugin stores
// the on/off value and nothing else.
//
// The module holds no failure handler: the engine skips a hook that throws
// or runs past its time limit, and draws the reply block as written.

import { atom, read, update } from 'claude-code';

import { DR_DEFAULTS } from './library.js';
import { markdownTables } from './markdown-adapter.js';
import { simplifyTables } from './text-table.js';

const STATUS_ENTRY = 'simplify-data: on';
// False at every session start: the engine's session state holds the value,
// and nothing stores it across sessions.
const isOn = atom({ plugin: 'dynamic-rounding', key: 'isOn' }, false);

export const register = (on) => {
  // The command name is a literal here and in the command hook's matcher:
  // `claude plugin validate` reads both to list the hook as answering its
  // own command.
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
    $.ui.status(isNowOn ? STATUS_ENTRY : undefined);
    return { text: isNowOn ? STATUS_ENTRY : 'simplify-data: off' };
  });

  // The hook reads the on/off value while drawing, so the engine draws every
  // reply block again when the value changes.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e);
    const text = simplifyTables(e.props.text, markdownTables(e.props.text), DR_DEFAULTS);
    return next({ ...e, props: { ...e.props, text } });
  });
};
