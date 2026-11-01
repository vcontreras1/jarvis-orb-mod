import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'jarvis-orb',
  component: 'Pane',
  requestId: 'jarvis-orb',
  props: {
    title: 'J.A.R.V.I.S.',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('en espera al empezar, en todas las superficies', async ($, on) => {
  on('command.register', () => ({ value: { command: 'jarvis' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /EN ESPERA/ }))?.text).toBe('EN ESPERA')
    await ui.unmount()
  }
})

test('cuenta las herramientas y dibuja la esfera en el escritorio', async ($, on) => {
  on('command.register', () => ({ value: { command: 'jarvis' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /herramienta/ }))?.text).toBe('1 herramienta en este turno')
  expect(await ui.find({ type: 'Svg' })).toBeTruthy()
  await ui.unmount()
})

test('un mod sin clave avisa una vez y no rompe el turno', async ($, on) => {
  on('command.register', () => ({ value: { command: 'jarvis' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: 'Hola Valeria. Todo en orden.' }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '' } }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const done = await $.turn.complete({ reason: 'answer' } as never)
  expect(done.text).toBe('Hola Valeria. Todo en orden.')
})
