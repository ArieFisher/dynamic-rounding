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

// Nothing sits beneath a test's hooks, so each one stands in for the engine's
// handling of its event. This one replaces the engine's drawing with one Text
// that the test can read.
const engineDrawing = ($, e) => {
  const { Text } = $.ui.resolve(e)

  return <Text>{e.props.text}</Text>
}

const drawnText = async (ui) => (await ui.find({ type: 'Text' }))?.text

test('a reply block shows simplified after one run of the toggle command and as written after a second, on every surface', async ($, on) => {
  const statusEntries: (string | undefined)[] = []
  on('command.register', () => ({ value: { command: 'simplify-data' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.status', (_, e) => {
    statusEntries.push(e.text)

    return { value: undefined }
  })
  on('ui.render', engineDrawing)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...REPLY_BLOCK, surface })

    expect(await drawnText(ui)).toBe(ORIGINALS)

    const onOutput = await $.command.run({ command: 'simplify-data' })
    expect(onOutput.text).toBe('simplify-data: on')
    expect(await drawnText(ui)).toBe(WRITTEN_TEXT)

    const offOutput = await $.command.run({ command: 'simplify-data' })
    expect(offOutput.text).toBe('simplify-data: off')
    expect(await drawnText(ui)).toBe(ORIGINALS)

    await ui.unmount()
  }

  expect(statusEntries).toEqual(SURFACES.flatMap(() => ['simplify-data: on', undefined]))
})

test('a reply block mounted with no run of the toggle command shows as written, on every surface', async ($, on) => {
  on('ui.render', engineDrawing)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...REPLY_BLOCK, surface })

    expect(await drawnText(ui)).toBe(ORIGINALS)
    await ui.unmount()
  }
})
