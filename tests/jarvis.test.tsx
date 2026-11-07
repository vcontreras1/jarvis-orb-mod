import { expect, mock, test } from 'claude-code/testing'

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

const conMotor = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  on('command.register', () => ({ value: { command: 'jarvis' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ({ text: e.text, context: e.context }))
  on('tool.register', () => ({ value: { tool: 'x' } }))
}

test('una petición de vídeo llena el panel y deja una pista a Claude', async ($, on) => {
  mock.store(on, {})
  conMotor(on)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const sent = await $.prompt.submit({ text: 'hazme un vídeo que explique esto' })

  expect(sent.context?.join('\n')).toMatch(/remotion:remotion-create/)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /PARA ESTO/ }))?.text).toMatch(/Vídeo y audio/)
  await ui.unmount()
})

test('una charla sin tema no añade nada al mensaje', async ($, on) => {
  mock.store(on, {})
  conMotor(on)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const sent = await $.prompt.submit({ text: 'ok, gracias' })

  expect(sent.context ?? []).toEqual([])
})

test('/jarvis-consejos apaga las pistas', async ($, on) => {
  mock.store(on, {})
  conMotor(on)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'jarvis-consejos', args: '' })
  const sent = await $.prompt.submit({ text: 'hazme un vídeo' })

  expect(sent.context ?? []).toEqual([])
})

test('recuerda entre sesiones que los consejos están apagados', async ($, on) => {
  mock.store(on, { consejos: false })
  conMotor(on)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const sent = await $.prompt.submit({ text: 'hazme un vídeo' })

  expect(sent.context ?? []).toEqual([])
})

test('«no funciona» no se confunde con un ejercicio de código', async ($, on) => {
  mock.store(on, {})
  conMotor(on)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const sent = await $.prompt.submit({ text: 'esto no funciona' })

  expect(sent.context ?? []).toEqual([])
})

test('/jarvis-skills da el detalle de un tema', async ($, on) => {
  mock.store(on, {})
  conMotor(on)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const answer = await $.command.run({ command: 'jarvis-skills', args: 'trading' })

  expect(String(answer.text)).toMatch(/trader-risk/)
})

test('aprende de lo que eliges: lo elegido sube y lo descartado baja', async ($, on) => {
  mock.store(on, {})
  conMotor(on)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__jarvis-orb__recordar_eleccion',
    tema: 'Vídeo y audio',
    elegidas: ['ffmpeg-llm:ffmpeg'],
    descartadas: ['remotion:remotion-create'],
  } as never)
  const sent = await $.prompt.submit({ text: 'hazme un vídeo' })
  const pista = sent.context?.join('\n') ?? ''

  expect(pista).toMatch(/ffmpeg-llm:ffmpeg: .*elegida 1/)
  expect(pista.indexOf('ffmpeg-llm:ffmpeg')).toBeLessThan(pista.indexOf('remotion:remotion-captions'))
  const descartada = pista.indexOf('remotion:remotion-create')
  expect(descartada === -1 || descartada > pista.indexOf('remotion:remotion-captions')).toBe(true)
})

test('«jarvis estatus» pide el informe aunque los consejos estén apagados', async ($, on) => {
  mock.store(on, { consejos: false })
  conMotor(on)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const sent = await $.prompt.submit({ text: 'Jarvis, estatus.' })

  expect(sent.context?.join('\n')).toMatch(/estatus\.md/)
})

test('una frase que solo menciona el estatus no lo dispara', async ($, on) => {
  mock.store(on, { consejos: false })
  conMotor(on)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const sent = await $.prompt.submit({ text: 'cambia cómo funciona jarvis estatus en el mod' })

  expect(sent.context ?? []).toEqual([])
})

const conVoz = (on: Parameters<Parameters<typeof test>[1]>[1], llamadas: string[]) => {
  conMotor(on)
  on('turn.complete', () => ({ text: 'Hola. Todo en orden.' }))
  on('process.run', (_, e) => {
    llamadas.push(e.argv.join(' '))

    return { value: { exitCode: 0, stdout: '/Users/prueba\n', stderr: '' } }
  })
}

test('Jarvis calla si no le hablas a él', async ($, on) => {
  const llamadas: string[] = []
  mock.store(on, {})
  conVoz(on, llamadas)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'ordena esta lista' })
  await $.turn.complete({ reason: 'answer', answer: 'Hola. Todo en orden.', durationMs: 1, isAborted: false, turnId: 't' })
  await new Promise(r => setTimeout(r, 20))

  expect(llamadas.some(l => l.includes('piper') || l.includes('curl'))).toBe(false)
})

test('sin clave, hablarle a Jarvis usa la voz gratis de Piper', async ($, on) => {
  const llamadas: string[] = []
  mock.store(on, {})
  conVoz(on, llamadas)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'Jarvis, ¿qué tal?' })
  await $.turn.complete({ reason: 'answer', answer: 'Hola. Todo en orden.', durationMs: 1, isAborted: false, turnId: 't' })
  await new Promise(r => setTimeout(r, 20))

  expect(llamadas.some(l => l.includes('es_ES-sharvard-medium'))).toBe(true)
})

test('para un vídeo también propone conectores y la voz gratis', async ($, on) => {
  mock.store(on, {})
  conMotor(on)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const sent = await $.prompt.submit({ text: 'hazme un vídeo explicativo' })
  const pista = sent.context?.join('\n') ?? ''

  expect(pista).toMatch(/Piper Sharvard hombre/)
  expect(pista).toMatch(/conector WhisperAI/)
})
