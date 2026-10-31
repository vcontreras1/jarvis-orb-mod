/** Qué está haciendo Claude: en espera, pensando o usando una herramienta. */
export type Phase = 'idle' | 'thinking' | 'tool'

export type OrbState = {
  phase: Phase
  /** Herramienta en marcha cuando phase es 'tool'. */
  tool: string | null
  /** Herramientas usadas en el turno actual. */
  tools: number
}

declare module 'claude-code' {
  interface PluginState {
    'jarvis-orb': { orb: OrbState }
  }
}
