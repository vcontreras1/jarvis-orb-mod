/** Qué está haciendo Claude: en espera, pensando, usando una herramienta o leyendo en voz alta. */
export type Phase = 'idle' | 'thinking' | 'tool' | 'speaking'

export type OrbState = {
  phase: Phase
  /** Herramienta en marcha cuando phase es 'tool'. */
  tool: string | null
  /** Herramientas usadas en el turno actual. */
  tools: number
}

/** Una skill o un agente que Jarvis propone. */
export type Sugerencia = {
  /** Nombre exacto: `remotion:remotion-create`, o el tipo de agente. */
  nombre: string
  tipo: 'skill' | 'agente' | 'conector' | 'herramienta'
  /** Para qué sirve, en pocas palabras. */
  para: string
  /** Veces que se ha usado, en todas las sesiones. */
  usos: number
  /** Veces que la persona la eligió o la descartó para este tema. */
  elegida: number
  descartada: number
}

/** Lo que el panel muestra debajo de la esfera. */
export type GuiaState = {
  /** Tema detectado en la última petición, o null si no encajó ninguno. */
  tema: string | null
  sugerencias: Sugerencia[]
  /** Cómo pedirlo mejor, para el tema detectado. */
  mejora: string | null
  /** Recordatorio de algo del catálogo que aún no se ha usado. */
  sinEstrenar: Sugerencia | null
  /** Skills y agentes distintos usados hasta ahora. */
  usadas: number
  activa: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'jarvis-orb': { orb: OrbState; guia: GuiaState }
  }
}
