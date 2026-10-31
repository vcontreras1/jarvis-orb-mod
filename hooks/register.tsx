import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

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
const SPEED: Record<Phase, number> = { idle: 1, thinking: 2.6, tool: 3.8 }
const LABEL: Record<Phase, string> = {
  idle: 'EN ESPERA',
  thinking: 'PROCESANDO…',
  tool: 'EJECUTANDO',
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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'jarvis',
      description: 'Abre el panel JARVIS con la esfera',
    })
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'jarvis' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Panel JARVIS abierto.' }
  })

  // Solo el turno principal cambia la fase; los subagentes no la tocan
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
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
    if (e.agentId === undefined) {
      await update($, orb, (s): OrbState => ({ ...s, phase: 'idle', tool: null }))
    }

    return next(e)
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
