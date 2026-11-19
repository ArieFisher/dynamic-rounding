// The engine test: the hooks module, loaded by the engine, on each surface.
// Run: claude plugin test claude-code-plugin

import { expect, test } from 'claude-code/testing'

const ORIGINALS = [
  'Revenue by item:',
  '',
  '| Item | Revenue |',
  '| --- | ---: |',
  '| Item 12 | 4,236,000 |',
  '| Item 7 | 8,120 |',
].join('\n')

const WRITTEN_TEXT = [
  'Revenue by item:',
  '',
  '| Item | Revenue |',
  '| --- | ---: |',
  '| Item 12 | 4,000,000 |',
  '| Item 7 | 8,000 |',
].join('\n')

const REPLY_BLOCK = {
  plugin: 'dynamic-rounding',
  component: 'AssistantMessage',
  props: { text: ORIGINALS, isFirstOfReply: true },
} as const

const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const

test('the toggle command simplifies a reply block, then restores it, on every surface', async ($, on) => {
  // Nothing sits beneath the plugin: each hook here stands for the engine.
  const statusEntries: (string | undefined)[] = []
  on('command.register', () => ({ value: { command: 'simplify-data' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.status', (_, e) => {
    statusEntries.push(e.text)

    return { value: undefined }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{e.props.text}</Text>
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...REPLY_BLOCK, surface })
    const drawnText = async () => (await ui.find({ type: 'Text' }))?.text

    expect(await drawnText()).toBe(ORIGINALS)

    const onOutput = await $.command.run({ command: 'simplify-data' })
    expect(onOutput.text).toBe('simplify-data: on')
    expect(await drawnText()).toBe(WRITTEN_TEXT)

    const offOutput = await $.command.run({ command: 'simplify-data' })
    expect(offOutput.text).toBe('simplify-data: off')
    expect(await drawnText()).toBe(ORIGINALS)

    await ui.unmount()
  }

  expect(statusEntries).toEqual(SURFACES.flatMap(() => ['simplify-data: on', undefined]))
})

test('the plugin starts off, so a reply block draws as written', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{e.props.text}</Text>
  })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...REPLY_BLOCK, surface })

    expect((await ui.find({ type: 'Text' }))?.text).toBe(ORIGINALS)
    await ui.unmount()
  }
})
