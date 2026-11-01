import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import type { OrbState, Phase } from '../types'

// Panel JARVIS: una esfera holográfica cian dibujada en SVG animado. Gira
// despacio en espera, más rápido mientras Claude piensa y aún más mientras
// usa una herramienta. La animación es SMIL dentro del propio SVG, así que
// solo se vuelve a dibujar al cambiar de fase.

const PANE = 'jarvis-orb'
const TITLE = 'J.A.R.V.I.S.'
const orb = atom({ plugin: 'jarvis-orb', key: 'orb' } as const, {
  phase: 'idle',
  tool: null,
  tools: 0,
} as OrbState)

const CYAN = '#45e2f7'
const SPEED: Record<Phase, number> = { idle: 1, thinking: 2.6, tool: 3.8, speaking: 3.2 }
const LABEL: Record<Phase, string> = {
  idle: 'EN ESPERA',
  thinking: 'PROCESANDO…',
  tool: 'EJECUTANDO',
  speaking: 'HABLANDO',
}

function orbSvg(phase: Phase): string {
  const k = SPEED[phase]
  const dur = (seconds: number) => `${(seconds / k).toFixed(2)}s`
  const bright = phase === 'idle' ? 0.6 : 1

  const spin = (seconds: number, reverse = false) =>
    `<animateTransform attributeName="transform" type="rotate" from="0" to="${reverse ? -360 : 360}" dur="${dur(seconds)}" repeatCount="indefinite"/>`

  // Meridianos: elipses que se estrechan y ensanchan desfasadas, como si la esfera girara
  const meridianDur = 9
  const meridians = [0, 1, 2, 3]
    .map(
      i =>
        `<ellipse rx="62" ry="62" class="line"><animate attributeName="rx" values="62;2;62" dur="${dur(meridianDur)}" begin="-${((meridianDur / k / 4) * i).toFixed(2)}s" repeatCount="indefinite"/></ellipse>`,
    )
    .join('')

  // Partículas en órbita
  const particles = [0, 72, 144, 216, 288]
    .map(
      (deg, i) =>
        `<circle r="${i % 2 ? 1.6 : 2.4}" cx="${(96 * Math.cos((deg * Math.PI) / 180)).toFixed(1)}" cy="${(96 * Math.sin((deg * Math.PI) / 180)).toFixed(1)}" fill="${CYAN}" opacity="0.8"/>`,
    )
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="-120 -120 240 240">
  <defs>
    <radialGradient id="core"><stop offset="0" stop-color="#e9fdff"/><stop offset="0.45" stop-color="${CYAN}"/><stop offset="1" stop-color="${CYAN}" stop-opacity="0"/></radialGradient>
    <radialGradient id="halo"><stop offset="0" stop-color="${CYAN}" stop-opacity="0.35"/><stop offset="1" stop-color="${CYAN}" stop-opacity="0"/></radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <style>
      .line { fill: none; stroke: ${CYAN}; stroke-width: 1; opacity: ${0.55 * bright}; }
      .ring { fill: none; stroke: ${CYAN}; }
    </style>
  </defs>
  <rect x="-120" y="-120" width="240" height="240" rx="20" fill="#05090b"/>
  <circle r="66" fill="url(#halo)"><animate attributeName="opacity" values="${0.5 * bright};${bright};${0.5 * bright}" dur="${dur(4)}" repeatCount="indefinite"/></circle>
  <g filter="url(#glow)">
    <g>${spin(40)}<circle r="100" class="ring" stroke-width="1.4" stroke-dasharray="1.5 6" opacity="${0.8 * bright}"/></g>
    <g>${spin(26, true)}<circle r="84" class="ring" stroke-width="3" stroke-dasharray="70 16 44 22 30 18" opacity="${0.75 * bright}"/></g>
    <g>${spin(60)}${particles}</g>
    <g>
      <circle r="62" class="line" style="opacity:${0.9 * bright}"/>
      <ellipse rx="62" ry="13" class="line"/>
      <ellipse cy="-31" rx="54" ry="11" class="line"/>
      <ellipse cy="31" rx="54" ry="11" class="line"/>
      ${meridians}
    </g>
    <ellipse rx="40" ry="8" class="ring" stroke-width="1.2" opacity="0.7">
      <animate attributeName="cy" values="-52;52;-52" dur="${dur(7)}" repeatCount="indefinite"/>
      <animate attributeName="rx" values="30;58;30;58;30" dur="${dur(7)}" repeatCount="indefinite"/>
    </ellipse>
    <circle r="13" fill="url(#core)">
      <animate attributeName="r" values="11;${phase === 'idle' ? 14 : 19};11" dur="${dur(3)}" repeatCount="indefinite"/>
    </circle>
  </g>
</svg>`
}

// ——— Voz: lee cada respuesta con ElevenLabs ———
// La clave llega por las opciones del mod (almacenamiento seguro) y se pasa a
// curl por la entrada estándar, para que no aparezca en la lista de procesos.
const ES_WORDS = new Set('que de la el los las en y para con por una un es se lo como más pero su al del este esta muy también puedes hay está son sí tu te mi'.split(' '))
const EN_WORDS = new Set('the and you is to of that it for with this are on be have not your can will but what if or an as at from they we'.split(' '))

function language(text: string): 'es' | 'en' {
  const lower = text.toLowerCase()
  let es = (lower.match(/[ñáéíóú¿¡]/g) ?? []).length * 2
  let en = 0
  for (const word of lower.match(/[a-záéíóúñü']+/g) ?? []) {
    if (ES_WORDS.has(word)) es++
    else if (EN_WORDS.has(word)) en++
  }
  return en > es ? 'en' : 'es'
}

function speakable(text: string, max: number): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' enlace ')
    .replace(/[*_#>|~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= max) return plain
  const cut = plain.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))

  return end > max * 0.5 ? cut.slice(0, end + 1) : cut
}

let isMuted = false
let session = 0
let warned = false
const file = (n: number) => `/tmp/jarvis-voz-${n}.mp3`

async function stopVoice($: EngineInterface) {
  session++
  await $.process.run(['pkill', '-f', '/tmp/jarvis-voz-']).catch(() => {})
}

// Pide el audio a ElevenLabs, lo guarda en /tmp y lo reproduce con afplay.
// Es decorativo: cualquier fallo se avisa una vez y no afecta al turno.
async function speak($: EngineInterface, raw: string, options: PluginOptions) {
  const text = speakable(raw, Number(options.max_caracteres) || 1500)
  if (!text) return
  if (!String(options.elevenlabs_api_key ?? '')) {
    if (!warned) {
      warned = true
      $.ui.toast('Jarvis: falta la clave de ElevenLabs (ajustes del mod jarvis-orb)')
    }

    return
  }

  await stopVoice($)
  const mine = session
  const out = file(mine)
  const voice = language(text) === 'en' ? options.voz_ingles : options.voz_espanol
  const config = [
    `url = "https://api.elevenlabs.io/v1/text-to-speech/${String(voice)}?output_format=mp3_44100_128"`,
    `header = "xi-api-key: ${String(options.elevenlabs_api_key)}"`,
    'header = "Content-Type: application/json"',
    'header = "Accept: audio/mpeg"',
    `data = ${JSON.stringify(JSON.stringify({ text, model_id: String(options.modelo) }))}`,
    `output = "${out}"`,
    'write-out = "%{http_code}"',
    'silent',
  ].join('\n')

  try {
    const got = await $.process.run(['curl', '-K', '-'], { stdin: config, timeoutMs: 60000 })
    if (mine !== session) return
    const status = got.stdout.trim()
    if (got.exitCode !== 0 || status !== '200') {
      const reason: Record<string, string> = {
        '401': 'la clave no es válida',
        '402': 'no quedan créditos',
        '422': 'el texto o la voz no son válidos',
        '429': 'demasiadas peticiones seguidas',
      }
      $.ui.toast(`Jarvis: ${reason[status] ?? 'no pude conectar con ElevenLabs'}`)

      return
    }
    await update($, orb, (s): OrbState => ({ ...s, phase: 'speaking', tool: null }))
    await $.process.run(['afplay', out], { timeoutMs: 600000 })
  } catch {
    // detenido por una respuesta nueva, o sin reproductor
  } finally {
    if (mine === session) {
      await update($, orb, (s): OrbState => (s.phase === 'speaking' ? { ...s, phase: 'idle' } : s)).catch(() => {})
    }
    void $.process.run(['rm', '-f', out]).catch(() => {})
  }
}


export const register: Register = (on, options) => {

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'jarvis',
      description: 'Abre el panel JARVIS con la esfera',
    })
    await $.command.register({
      name: 'jarvis-voz',
      description: 'Activa o desactiva la lectura en voz alta de las respuestas',
    })
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'jarvis' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Panel JARVIS abierto.' }
  })

  // /jarvis-voz apaga o enciende la lectura en voz alta (solo esta sesión)
  on('command.run', { command: 'jarvis-voz' }, async $ => {
    isMuted = !isMuted
    if (isMuted) await stopVoice($)

    return { text: isMuted ? 'Jarvis ya no lee las respuestas.' : 'Jarvis leerá las respuestas en voz alta.' }
  })

  // Solo el turno principal cambia la fase; los subagentes no la tocan
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await stopVoice($) // una respuesta nueva calla la anterior
      await update($, orb, (): OrbState => ({ phase: 'thinking', tool: null, tools: 0 }))
    }

    return next(e)
  })

  // El panel es decorativo: si actualizar el estado falla, la herramienta
  // se ejecuta igual
  on('tool.call', async ($, e, next) => {
    await update($, orb, (s): OrbState => ({ phase: 'tool', tool: e.tool, tools: s.tools + 1 })).catch(() => {})
    try {
      return await next(e)
    } finally {
      await update($, orb, (s): OrbState => (s.phase === 'idle' ? s : { ...s, phase: 'thinking', tool: null })).catch(
        () => {},
      )
    }
  })

  on('turn.complete', async ($, e, next) => {
    const answer = await next(e)
    if (e.agentId !== undefined) return answer

    await update($, orb, (s): OrbState => ({ ...s, phase: 'idle', tool: null }))
    if (e.reason === 'answer' && !isMuted) void speak($, answer.text, options)

    return answer
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const state = await read($, orb)
    const label =
      state.phase === 'tool' && state.tool ? `${LABEL.tool} · ${state.tool}` : LABEL[state.phase]
    const detail =
      state.tools > 0 ? `${state.tools} herramienta${state.tools === 1 ? '' : 's'} en este turno` : ''

    // El terminal no dibuja SVG: ahí basta con el estado en texto
    if (!('Svg' in ui)) {
      return (
        <Box flexDirection="column">
          <Text bold>{TITLE}</Text>
          <Text dimColor={state.phase === 'idle'}>{label}</Text>
          {detail && <Text dimColor>{detail}</Text>}
        </Box>
      )
    }

    const { Svg } = ui

    return (
      <Box flexDirection="column" alignItems="center">
        <Svg
          source={orbSvg(state.phase)}
          alt={`Esfera JARVIS: ${label}`}
          isInteractive
        />
        <Text bold>{label}</Text>
        {detail && <Text dimColor>{detail}</Text>}
      </Box>
    )
  })
}
