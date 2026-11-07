import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import type { GuiaState, OrbState, Phase, Sugerencia } from '../types'

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

// Jarvis solo habla si le hablas a él, o con /jarvis-voz para toda la conversación
let modoVoz = false
let aJarvis = false
let casaDir = ''
let session = 0
let warned = false
const file = (n: number) => `/tmp/jarvis-voz-${n}.mp3`

async function stopVoice($: EngineInterface) {
  session++
  await $.process.run(['pkill', '-f', '/tmp/jarvis-voz-']).catch(() => {})
}

// Pide el audio a ElevenLabs, lo guarda en /tmp y lo reproduce con afplay.
// Es decorativo: cualquier fallo se avisa una vez y no afecta al turno.
// Avisa una sola vez por sesión, para no repetir el mensaje en cada respuesta
function notifyOnce($: EngineInterface, message: string) {
  if (warned) return
  warned = true
  $.ui.toast(message)
}

// Voz gratis, sin red: Piper en español y, si falta o el texto es inglés, la voz del Mac
async function vozPiper($: EngineInterface, text: string, n: number): Promise<boolean> {
  if (!casaDir || language(text) === 'en') return false
  const out = `/tmp/jarvis-voz-${n}.wav`
  const modelo = `${casaDir}/.local/share/piper-voices/es_ES-sharvard-medium.onnx`
  try {
    const hecho = await $.process.run([`${casaDir}/.local/bin/piper`, '-m', modelo, '-s', '0', '-f', out], { stdin: text, timeoutMs: 60000 })
    if (hecho.exitCode !== 0) return false
    await $.process.run(['afplay', out], { timeoutMs: 600000 })

    return true
  } catch {
    return false
  } finally {
    void $.process.run(['rm', '-f', out]).catch(() => {})
  }
}

async function systemVoice($: EngineInterface, text: string) {
  await stopVoice($)
  const mine = session
  await update($, orb, (s): OrbState => ({ ...s, phase: 'speaking', tool: null })).catch(() => {})
  if (!(await vozPiper($, text, mine)) && mine === session) await $.audio.speak(text).catch(() => {})
  if (mine === session) {
    await update($, orb, (s): OrbState => (s.phase === 'speaking' ? { ...s, phase: 'idle' } : s)).catch(() => {})
  }
}

async function speak($: EngineInterface, raw: string, options: PluginOptions) {
  const text = speakable(raw, Number(options.max_caracteres) || 1500)
  if (!text) return
  if (!String(options.elevenlabs_api_key ?? '')) {
    notifyOnce($, 'Jarvis: sin clave de ElevenLabs, uso una voz gratis')
    await systemVoice($, text)

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
      notifyOnce($, `Jarvis: ${reason[status] ?? 'no pude conectar con ElevenLabs'}; uso una voz gratis`)
      await systemVoice($, text)

      return
    }
    await update($, orb, (s): OrbState => ({ ...s, phase: 'speaking', tool: null }))
    await $.process.run(['afplay', out], { timeoutMs: 600000 })
  } catch (err) {
    // Si no lo detuvo una respuesta nueva, algo falló al pedir o reproducir el
    // audio: no se deja en silencio, se lee con una voz gratis y se dice por qué
    if (mine === session) {
      const why = err instanceof Error ? err.message.slice(0, 80) : 'error desconocido'
      notifyOnce($, `Jarvis: ElevenLabs falló (${why}); uso una voz gratis`)
      await systemVoice($, text)
    }
  } finally {
    if (mine === session) {
      await update($, orb, (s): OrbState => (s.phase === 'speaking' ? { ...s, phase: 'idle' } : s)).catch(() => {})
    }
    void $.process.run(['rm', '-f', out]).catch(() => {})
  }
}

// ——— Guía: recuerda, recomienda y usa las skills y los agentes ———
// El catálogo cubre lo que se pide más a menudo. No hace falta que esté completo:
// Claude ve la lista entera de skills y usa estas pistas como punto de partida.
type Entrada = { nombre: string; tipo: Sugerencia['tipo']; para: string }
type Tema = { titulo: string; palabras: string[]; usar: Entrada[]; mejora: string }

const S = (nombre: string, para: string): Entrada => ({ nombre, tipo: 'skill', para })
const A = (nombre: string, para: string): Entrada => ({ nombre, tipo: 'agente', para })
// Conectores (MCP) y programas instalados en el Mac: se nombran como aparecen en Claude
const M = (nombre: string, para: string): Entrada => ({ nombre, tipo: 'conector', para })
const H = (nombre: string, para: string): Entrada => ({ nombre, tipo: 'herramienta', para })

const CATALOGO: Tema[] = [
  {
    titulo: 'Clase y ejercicios de código',
    palabras: ['python', 'spyder', '.py', 'ejercicio', 'tarea', 'enunciado', 'blackboard', 'bucle', 'variable', 'funcion'],
    usar: [
      S('anthropic-skills:learn', 'te enseña un concepto hasta que lo entiendas'),
      S('anthropic-skills:pdf', 'leer bien el enunciado en PDF'),
      S('remotion:remotion-create', 'un vídeo explicativo con gráficos'),
    ],
    mejora: 'Pega el enunciado y di qué comandos has visto en clase, para no usar otros.',
  },
  {
    titulo: 'Entender algo',
    palabras: ['no entiendo', 'entiendo', 'entender', 'explica', 'explicame', 'explicar', 'explicacion', 'que significa', 'como funciona', 'aprender', 'ensename'],
    usar: [
      S('anthropic-skills:learn', 'explicación a tu ritmo, comprobando que lo sigues'),
      S('remotion:remotion-create', 'verlo en un vídeo con gráficos'),
    ],
    mejora: 'Di qué parte exacta se te atasca y qué ya sabes.',
  },
  {
    titulo: 'Vídeo y audio',
    palabras: ['video', 'reel', 'animacion', 'subtitulo', 'clip', 'voz en off', 'locucion', 'musica', 'ffmpeg', 'mp4'],
    usar: [
      S('remotion:remotion-create', 'vídeos con gráficos y texto hechos con código'),
      S('remotion:remotion-captions', 'subtítulos animados'),
      S('social-media-skills:ai-video', 'vídeo generado con IA'),
      S('social-media-skills:ai-voiceover', 'locución con voz de IA'),
      S('ffmpeg-llm:ffmpeg', 'convertir, cortar o comprimir un archivo'),
      A('ffmpeg-llm:ffmpeg-expert', 'arreglar un comando de FFmpeg que falla'),
      H('Piper Sharvard hombre', 'tu voz gratis por defecto, sin internet'),
      H('Kokoro', 'otra voz gratis local, muy usada'),
      M('WhisperAI', 'transcribir un audio o vídeo a texto'),
      M('AI Producer', 'editar y subtitular un vídeo grabado'),
      M('ElevenLabs', 'voz de Jarvis; gasta créditos'),
    ],
    mejora: 'Di duración, público, formato (vertical u horizontal) y si lleva voz.',
  },
  {
    titulo: 'Presentaciones',
    palabras: ['presentacion', 'diapositiva', 'slides', 'powerpoint', 'pptx', 'pitch', 'deck'],
    usar: [
      S('anthropic-skills:pptx', 'crear o editar un PowerPoint'),
      S('figma:figma-use-slides', 'diapositivas en Figma'),
      S('superme:get-buy-in', 'convencer a quien te escucha'),
      M('Canva', 'diseñar diapositivas con plantillas; necesita autorizarse'),
      M('Figma', 'diapositivas y diseños en Figma'),
      M('Google Drive', 'guardar o crear Google Slides'),
    ],
    mejora: 'Di quién la verá, cuántos minutos tienes y qué decisión quieres conseguir.',
  },
  {
    titulo: 'Documentos y PDF',
    palabras: ['word', 'docx', 'pdf', 'informe', 'ensayo', 'memoria', 'carta', 'curriculum', 'cv'],
    usar: [
      S('anthropic-skills:docs', 'un documento para compartir y comentar'),
      S('anthropic-skills:docx', 'un archivo de Word'),
      S('anthropic-skills:pdf', 'leer, unir o crear PDF'),
      S('pdf-viewer:annotate', 'anotar un PDF juntos'),
      S('superme:review-doc', 'una revisión crítica del texto'),
      M('Claude Docs', 'documento compartible que se edita y comenta'),
      M('Google Drive', 'guardar o crear Google Docs'),
    ],
    mejora: 'Di el formato final y quién lo va a leer.',
  },
  {
    titulo: 'Excel y datos',
    palabras: ['excel', 'xlsx', 'csv', 'hoja de calculo', 'datos', 'dataset', 'grafico', 'dashboard', 'estadistic*', 'sql', 'regresion'],
    usar: [
      S('anthropic-skills:xlsx', 'crear o arreglar un Excel'),
      S('data:explore-data', 'primera lectura de un conjunto de datos'),
      S('data:statistical-analysis', 'análisis estadístico'),
      S('data:create-viz', 'gráficos claros'),
      S('data:build-dashboard', 'un panel de datos'),
    ],
    mejora: 'Di qué decisión quieres tomar con los datos.',
  },
  {
    titulo: 'Investigar',
    palabras: ['investig*', 'busca informacion', 'comparar', 'compara', 'tendencia', 'estado del arte', 'fuentes', 'informe sobre'],
    usar: [
      S('anthropic-skills:deep-research', 'investigación con varias fuentes citadas'),
      S('brightdata-plugin:live-research', 'informe con datos de la web en vivo'),
      A('general-purpose', 'buscar en paralelo mientras sigues con otra cosa'),
      M('Tavily', 'búsqueda web con fuentes para investigar'),
      M('Exa', 'buscar páginas por significado, no solo por palabras'),
      M('Firecrawl', 'leer páginas y buscar artículos científicos; gasta créditos'),
      M('Claude Docs', 'entregar la investigación como documento'),
    ],
    mejora: 'Di la pregunta que quieres responder y hasta qué fecha sirve la información.',
  },
  {
    titulo: 'Competencia y mercado',
    palabras: ['competencia', 'competidor', 'mercado', 'benchmark', 'sector'],
    usar: [
      S('marketing:competitive-brief', 'resumen de la competencia'),
      S('brightdata-plugin:competitive-intel', 'precios y posicionamiento con datos reales'),
      S('social-media-skills:competitor-analysis', 'qué hacen en redes'),
    ],
    mejora: 'Nombra tres competidores y tu mercado.',
  },
  {
    titulo: 'Idea de negocio',
    palabras: ['idea de negocio', 'startup', 'emprender', 'validar', 'precio', 'pricing', 'inversores', 'fundraising', 'plan de negocio', 'mi negocio', 'mi empresa'],
    usar: [
      S('superme:validate-an-idea', 'poner a prueba la idea'),
      S('superme:set-pricing', 'decidir precios'),
      S('superme:fundraise', 'preparar una ronda'),
      S('small-business:smb-router', 'te lleva a la skill de negocio adecuada'),
    ],
    mejora: 'Di a quién le vendes y qué problema le resuelves.',
  },
  {
    titulo: 'Redes sociales',
    palabras: ['instagram', 'tiktok', 'linkedin', 'youtube', 'redes sociales', 'post', 'carrusel', 'caption', 'hashtag', 'hook', 'contenido', 'viral'],
    usar: [
      S('social-media-skills:hook-writer', 'una primera frase que atrape'),
      S('social-media-skills:caption-writer', 'textos para publicaciones'),
      S('social-media-skills:carousel-writer', 'carruseles'),
      S('social-media-skills:content-calendar', 'calendario de publicaciones'),
      S('social-media-skills:batch-content-plan', 'preparar varias piezas de golpe'),
      M('Metricool', 'programar publicaciones y ver métricas'),
      M('Canva', 'piezas gráficas para redes; necesita autorizarse'),
    ],
    mejora: 'Di la red, a quién le hablas y qué acción quieres que hagan.',
  },
  {
    titulo: 'Marketing',
    palabras: ['marketing', 'campana', 'anuncio', 'newsletter', 'email marketing', 'seo', 'lanzamiento', 'marca'],
    usar: [
      S('marketing:campaign-plan', 'plan de campaña'),
      S('marketing:email-sequence', 'secuencia de correos'),
      S('marketing:seo-audit', 'auditoría SEO'),
      S('marketing:brand-review', 'revisar si encaja con la marca'),
    ],
    mejora: 'Di objetivo, presupuesto y fecha.',
  },
  {
    titulo: 'Webs y diseño',
    palabras: ['pagina web', 'hazme una web', 'crea una web', 'landing', 'sitio web', 'interfaz', 'figma', 'mockup', 'logo', 'poster', 'diseno', 'app movil'],
    usar: [
      S('frontend-design:frontend-design', 'una interfaz con personalidad'),
      S('animatedwebs:site', 'web animada completa'),
      S('figma:figma-generate-design', 'diseñar en Figma'),
      S('design:design-critique', 'crítica de un diseño'),
      S('anthropic-skills:canvas-design', 'pósteres y piezas visuales'),
    ],
    mejora: 'Comparte una web que te guste y di qué debe hacer quien entre.',
  },
  {
    titulo: 'Imágenes',
    palabras: ['imagen', 'foto', 'ilustracion', 'miniatura', 'thumbnail', 'infografia'],
    usar: [
      S('social-media-skills:image-prompt', 'un prompt que dé buena imagen'),
      S('social-media-skills:ai-image-editing', 'editar una imagen con IA'),
      S('social-media-skills:thumbnail-design', 'miniaturas'),
      S('social-media-skills:infographic-and-data-viz', 'infografías'),
      M('Figma', 'diseñar o editar en Figma'),
      M('Higgsfield', 'imágenes y vídeo con IA; gasta créditos'),
    ],
    mejora: 'Di tamaño, estilo y dónde se va a usar.',
  },
  {
    titulo: 'Bolsa y trading',
    palabras: ['trading', 'trader', 'bolsa', 'etf', 'sp500', 'nasdaq100', 'acciones', 'accion de', 'ticker', 'cartera', 'earnings', 'nasdaq', 'cripto'],
    usar: [
      S('day-trader-skill:trader-analyst', 'analizar un valor'),
      S('day-trader-skill:trader-risk', 'comprobar el riesgo frente a tus límites'),
      S('day-trader-skill:trader-news', 'noticias que mueven el mercado'),
      S('sp-global:tear-sheet', 'ficha de una empresa'),
    ],
    mejora: 'Di el valor, tu horizonte y tu riesgo máximo. Es análisis, no asesoramiento.',
  },
  {
    titulo: 'Finanzas y contabilidad',
    palabras: ['contabilidad', 'balance', 'cuenta de resultados', 'flujo de caja', 'cash flow', 'factura', 'presupuesto', 'impuesto', 'asiento'],
    usar: [
      S('finance:financial-statements', 'estados financieros'),
      S('finance:variance-analysis', 'por qué se desvían las cifras'),
      S('finance:journal-entry', 'asientos contables'),
      S('small-business:cash-flow-snapshot', 'foto de la caja de un negocio'),
    ],
    mejora: 'Di el periodo y adjunta las cifras.',
  },
  {
    titulo: 'Correo y agenda',
    palabras: ['correo', 'email', 'gmail', 'bandeja', 'calendario', 'agenda', 'reunion', 'mi dia', 'buenos dias'],
    usar: [
      S('anthropic-skills:morning', 'resumen de tu día'),
      S('small-business:inbox-manager', 'ordenar el correo'),
      S('superme:prep-for-a-meeting', 'preparar una reunión'),
    ],
    mejora: 'Di con quién es y qué necesitas que salga de ahí.',
  },
  {
    titulo: 'Trabajo y carrera',
    palabras: ['entrevista', 'buscar trabajo', 'mejor trabajo', 'empleo', 'sueldo', 'salario', 'cambiar de trabajo', 'practicas', 'aumento de sueldo', 'oferta de trabajo', 'linkedin perfil'],
    usar: [
      S('superme:prep-for-an-interview', 'preparar una entrevista'),
      S('superme:change-jobs', 'decidir un cambio de trabajo'),
      S('superme:ask-for-a-raise', 'pedir un aumento'),
    ],
    mejora: 'Pega la oferta y di qué te preocupa.',
  },
  {
    titulo: 'Escribir mejor',
    palabras: ['reescribe', 'mejora el texto', 'corrige', 'suena a ia', 'humaniza', 'tono', 'redact*', 'reescribir', 'corregir'],
    usar: [
      S('anthropic-skills:humanizer', 'que no suene a IA'),
      S('social-media-skills:voice-builder', 'escribir con tu voz'),
      S('design:ux-copy', 'textos de una interfaz'),
    ],
    mejora: 'Di quién lo lee y pega un ejemplo de tu estilo.',
  },
  {
    titulo: 'Contratos y revisión crítica',
    palabras: ['contrato', 'clausula', 'legal', 'abogado', 'revisa esto', 'fallos', 'antes de enviar'],
    usar: [
      S('small-business:contract-review', 'revisar un contrato'),
      S('anthropic-skills:revisor-abogado-del-diablo', 'buscar fallos y comprobar datos'),
    ],
    mejora: 'Di qué te preocupa y si lo vas a firmar o a publicar.',
  },
  {
    titulo: 'Sacar datos de la web',
    palabras: ['scrape', 'scraping', 'extraer datos', 'descargar datos', 'precios de', 'menciones', 'que dicen de'],
    usar: [
      S('brightdata-plugin:scrape', 'leer páginas difíciles'),
      S('brightdata-plugin:data-feeds', 'datos limpios de plataformas conocidas'),
      S('brightdata-plugin:price-comparison', 'comparar precios'),
      S('brightdata-plugin:brand-listening', 'qué se dice de una marca'),
    ],
    mejora: 'Di de qué web y qué campos quieres.',
  },
  {
    titulo: 'Programar y revisar código',
    palabras: ['bug', 'error en', 'refactor', 'mi codigo', 'este codigo', 'repositorio', 'github', 'pull request', 'api'],
    usar: [
      S('code-review', 'buscar errores antes de entregar'),
      S('simplify', 'dejar el código más limpio'),
      S('security-review', 'revisar la seguridad'),
      A('Plan', 'diseñar un cambio grande antes de tocarlo'),
      A('Explore', 'buscar por un proyecto grande'),
    ],
    mejora: 'Di cómo reproducir el fallo y qué esperabas.',
  },
  {
    titulo: 'Automatizar',
    palabras: ['automatiz*', 'cada dia', 'cada semana', 'recuerdame', 'programa una', 'recurrente', 'todos los dias', 'todas las semanas'],
    usar: [
      S('schedule', 'tareas que se ejecutan solas en la nube'),
      S('loop', 'repetir algo cada cierto tiempo'),
      S('update-config', 'reglas automáticas de Claude Code'),
    ],
    mejora: 'Di cada cuánto y qué debe pasar si algo falla.',
  },
  {
    titulo: 'Crear skills, mods y agentes',
    palabras: ['crear una skill', 'nueva skill', 'crea un agente', 'mod', 'plugin', 'jarvis'],
    usar: [
      S('anthropic-skills:skill-creator', 'crear o mejorar una skill'),
      S('plugin-authoring', 'cambiar paneles y comportamiento de Claude'),
      S('claude-api', 'apps con la API de Claude'),
      A('claude-code-guide', 'dudas sobre Claude Code'),
    ],
    mejora: 'Di qué debe pasar y cuándo.',
  },
]

const GUIA = `# Jarvis: tú eliges las skills

La persona tiene cientos de skills, agentes y conectores (MCP), no recuerda qué hace cada uno y quiere decidir por sí misma cuáles usar. Jarvis es su especialista en ellos. En la conversación principal:

1. Si una petición pide trabajo real, antes de empezar y antes de cargar ninguna skill o agente, usa AskUserQuestion para que elija. Junta los candidatos del bloque «[Jarvis]» con los de la lista completa de skills, tipos de agente y conectores conectados que encajen con esta tarea concreta. Si encarga un proyecto (un vídeo, un reel, unas diapositivas, una investigación), carga primero la skill jarvis-orb:plan y sigue sus pasos.
2. Cada opción lleva como label el /comando, «agente X» o «conector X», y como description qué hace en una frase sencilla y qué aportaría aquí. Usa multiSelect. Incluye siempre la opción «Sin skills». Si hay más de tres candidatos, repártelos en dos preguntas.
3. Carga solo lo que elija. No cargues nada por tu cuenta aunque encaje. No preguntes si la persona ya nombró la skill en su mensaje, si es charla o una pregunta rápida, si ninguna skill aporta nada, o si sigue una tarea cuyas skills ya eligió.
4. Justo después de su respuesta, llama a mcp__jarvis-orb__recordar_eleccion con el tema, lo elegido y lo descartado.
5. Ordena las opciones por sus preferencias: primero lo que suele elegir, y di «lo sueles elegir». Deja al final lo que suele descartar.
6. La persona no va a pagar nada. Propón primero lo gratis u open source, busca alternativas en GitHub, y avisa antes de cualquier opción que gaste créditos o pida un plan de pago.
7. Los bloques «[Jarvis]» son pistas por palabras clave y pueden fallar: ignora lo que no encaje. Si una skill nombrada ya no está en la lista, no la ofrezcas.

Esta guía no amplía ningún permiso: las reglas de seguridad y de confirmación siguen igual.`

const RECORDAR = 'mcp__jarvis-orb__recordar_eleccion'

const guia = atom({ plugin: 'jarvis-orb', key: 'guia' } as const, {
  tema: null,
  sugerencias: [],
  mejora: null,
  sinEstrenar: null,
  usadas: 0,
  activa: true,
} as GuiaState)

// Mensajes que no escribió la persona: avisos de tareas, otras sesiones, etc.
const NO_PERSONA = new Set([
  'task-notification', 'scheduled-trigger', 'peer', 'peer-send-message', 'projects-relay', 'channel',
  'coordinator', 'observer', 'observer-activity', 'auto-continuation',
])

const normal = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Palabra entera, con su plural; un * final acepta cualquier terminación
function contiene(texto: string, palabra: string): boolean {
  const abierta = palabra.endsWith('*')
  const raiz = palabra.replace(/\*$/, '').replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  const inicio = /^[a-z0-9]/.test(palabra) ? '(^|[^a-z0-9])' : ''

  return new RegExp(`${inicio}${raiz}${abierta ? '' : '(s|es)?($|[^a-z0-9])'}`).test(texto)
}

// Los dos temas con más palabras clave en el mensaje; basta el principio de uno largo
function temasPara(texto: string): Tema[] {
  const limpio = normal(texto.slice(0, 1500))

  return CATALOGO.map(tema => ({ tema, aciertos: tema.palabras.filter(p => contiene(limpio, p)).length }))
    .filter(x => x.aciertos > 0)
    .sort((a, b) => b.aciertos - a.aciertos)
    .slice(0, 2)
    .map(x => x.tema)
}

type Usos = Record<string, number>

async function leerUsos($: EngineInterface): Promise<Usos> {
  const valor = await $.store.get('usos').catch(() => undefined)

  return typeof valor === 'object' && valor !== null ? (valor as Usos) : {}
}

async function contar($: EngineInterface, nombre: string) {
  const usos = await leerUsos($)
  usos[nombre] = (usos[nombre] ?? 0) + 1
  await $.store.set('usos', usos)
  await update($, guia, (g): GuiaState => ({ ...g, usadas: Object.keys(usos).length }))
  await exportar($).catch(() => {})
}

// Preferencias: qué eligió y qué descartó la persona en cada tema
type Preferencias = Record<string, Record<string, { elegida: number; descartada: number }>>
type Eleccion = { tema: string; elegidas?: string[]; descartadas?: string[] }

async function leerPreferencias($: EngineInterface): Promise<Preferencias> {
  const valor = await $.store.get('preferencias').catch(() => undefined)

  return typeof valor === 'object' && valor !== null ? (valor as Preferencias) : {}
}

// Carpeta que comparten el mod y la tarea que prepara el estatus cada 15 días
let carpeta = ''
const INFORME = '~/.claude/jarvis/estatus.md'

async function exportar($: EngineInterface) {
  if (!carpeta) return
  const datos = { usos: await leerUsos($), preferencias: await leerPreferencias($) }
  await $.fs.write(`${carpeta}/preferencias.json`, JSON.stringify(datos, null, 2))
}

const pideEstatus = (texto: string) => /^\W*jarvis\W+(estatus|status|estado)\W*$/.test(normal(texto).trim())

const PISTA_ESTATUS = `[Jarvis estatus] La persona pide su estatus y va a oír la respuesta. Lee ${INFORME} y responde solo con su sección «Para leer en voz alta», en frases cortas, sin listas, sin enlaces y sin la línea de skills. Di la fecha del informe. Si el archivo no existe, dilo en una frase y explica que la tarea «Jarvis estatus» aún no ha terminado. No instales nada.`

async function recordar($: EngineInterface, { tema, elegidas = [], descartadas = [] }: Eleccion) {
  const prefs = await leerPreferencias($)
  const delTema = (prefs[tema] ??= {})
  for (const nombre of elegidas) (delTema[nombre] ??= { elegida: 0, descartada: 0 }).elegida++
  for (const nombre of descartadas) (delTema[nombre] ??= { elegida: 0, descartada: 0 }).descartada++
  await $.store.set('preferencias', prefs)
  await exportar($).catch(() => {})
}

const conUsos = (entrada: Entrada, usos: Usos, tema?: Preferencias[string]): Sugerencia => ({
  ...entrada,
  usos: usos[entrada.nombre] ?? 0,
  elegida: tema?.[entrada.nombre]?.elegida ?? 0,
  descartada: tema?.[entrada.nombre]?.descartada ?? 0,
})

// Todo el primer tema y parte del segundo, con lo que suele elegir delante
function sugerenciasDe(temas: Tema[], usos: Usos, prefs: Preferencias): Sugerencia[] {
  const vistas = new Set<string>()
  const todas = temas.flatMap((t, i) =>
    (i === 0 ? t.usar : t.usar.slice(0, 3)).map(e => conUsos(e, usos, prefs[t.titulo])),
  )

  return todas
    .filter(s => !vistas.has(s.nombre) && vistas.add(s.nombre))
    .sort((a, b) => b.elegida - b.descartada - (a.elegida - a.descartada))
    .slice(0, 10)
}

function historial(s: Sugerencia): string {
  if (s.elegida === 0 && s.descartada === 0) return s.usos === 0 ? 'sin estrenar' : ''

  return [s.elegida && `elegida ${s.elegida}`, s.descartada && `descartada ${s.descartada}`].filter(Boolean).join(', ')
}

// Cada petición recuerda otra cosa del catálogo que aún no se ha probado
let turnos = 0
function sinEstrenar(usos: Usos): Sugerencia | null {
  const vistas = new Set<string>()
  const pendientes = CATALOGO.flatMap(t => t.usar).filter(
    e => !usos[e.nombre] && !vistas.has(e.nombre) && vistas.add(e.nombre),
  )
  if (pendientes.length === 0) return null

  return conUsos(pendientes[turnos++ % pendientes.length]!, usos)
}

const comando = (s: Pick<Sugerencia, 'nombre' | 'tipo'>) =>
  s.tipo === 'agente' ? `agente ${s.nombre}` : s.tipo === 'conector' ? `conector ${s.nombre}` : s.tipo === 'herramienta' ? s.nombre : `/${s.nombre}`

function pista(temas: Tema[], sugerencias: Sugerencia[]): string {
  const candidatas = sugerencias
    .map(s => `- ${comando(s)}: ${s.para}${historial(s) && ` (${historial(s)})`}`)
    .join('\n')

  return [
    `[Jarvis] Pista por palabras clave, puede fallar. Tema: ${temas.map(t => t.titulo).join(', ')}.`,
    `Candidatas, para que la persona elija:\n${candidatas}`,
    `Para pedirlo mejor: ${temas[0]!.mejora}`,
  ].join('\n')
}

async function leerConsejos($: EngineInterface) {
  consejos = (await $.store.get('consejos').catch(() => undefined)) !== false
}

let consejos = true

function guiaCompleta(args: string, usos: Usos): string {
  const usadas = Object.entries(usos).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const pie = usadas.length
    ? `\n\n**Lo que más usas:** ${usadas.map(([n, c]) => `${n} (${c})`).join(', ')}`
    : ''
  const buscado = args.trim()
  const temas = buscado ? temasPara(buscado) : CATALOGO
  if (temas.length === 0) return `No tengo un tema para «${buscado}». Prueba \`/jarvis-skills\` para verlos todos.`
  if (!buscado) {
    const filas = temas.map(t => `- **${t.titulo}:** ${t.usar.slice(0, 3).map(e => `\`${comando(e)}\``).join(', ')}`)

    return `## Tus skills por tema\n\n${filas.join('\n')}\n\nEscribe \`/jarvis-skills video\` para ver el detalle de un tema.${pie}`
  }

  return temas
    .map(t => {
      const filas = t.usar.map(e => `- \`${comando(e)}\`: ${e.para}${usos[e.nombre] ? '' : ' (sin estrenar)'}`)

      return `## ${t.titulo}\n\n${filas.join('\n')}\n\n**Para pedirlo mejor:** ${t.mejora}`
    })
    .join('\n\n')
}


export const register: Register = (on, options) => {

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'jarvis',
      description: 'Abre el panel JARVIS con la esfera',
    })
    await $.command.register({
      name: 'jarvis-voz',
      description: 'Hace que Jarvis lea todas las respuestas de esta sesión, o deja de hacerlo',
    })
    await $.command.register({
      name: 'jarvis-skills',
      description: 'Muestra qué skill o agente usar para cada cosa',
      argumentHint: '[tema]',
    })
    await $.command.register({
      name: 'jarvis-consejos',
      description: 'Activa o desactiva las recomendaciones de skills de Jarvis',
    })
    await $.tool.register({
      name: 'recordar_eleccion',
      description:
        'Guarda qué skills y agentes eligió y descartó la persona para un tema, para que Jarvis aprenda sus preferencias. Llámala justo después de su respuesta.',
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: {
          tema: { type: 'string', description: 'El tema del bloque [Jarvis], o uno breve si no lo hubo.' },
          elegidas: { type: 'array', items: { type: 'string' }, description: 'Nombres elegidos, sin barra.' },
          descartadas: { type: 'array', items: { type: 'string' }, description: 'Nombres ofrecidos y no elegidos.' },
        },
        required: ['tema'],
      },
    })
    const casa = await $.process.run(['printenv', 'HOME']).catch(() => null)
    casaDir = casa?.stdout.trim() ?? ''
    if (casaDir) carpeta = `${casaDir}/.claude/jarvis`
    await exportar($).catch(() => {})
    await leerConsejos($)
    const usos = await leerUsos($)
    await update($, guia, (g): GuiaState => ({
      ...g,
      activa: consejos,
      usadas: Object.keys(usos).length,
      sinEstrenar: sinEstrenar(usos),
    })).catch(() => {})
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'jarvis' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Panel JARVIS abierto.' }
  })

  // /jarvis-voz lee todas las respuestas de esta sesión; sin él, solo si le hablas a Jarvis
  on('command.run', { command: 'jarvis-voz' }, async $ => {
    modoVoz = !modoVoz
    if (!modoVoz) await stopVoice($)

    return { text: modoVoz ? 'Jarvis leerá todas las respuestas en voz alta.' : 'Jarvis solo hablará cuando le hables a él.' }
  })

  // /jarvis-skills [tema]: la chuleta completa, o el detalle de un tema
  on('command.run', { command: 'jarvis-skills' }, async ($, e) => ({ text: guiaCompleta(e.args, await leerUsos($)) }))

  // /jarvis-consejos apaga o enciende las recomendaciones, en todas las sesiones
  on('command.run', { command: 'jarvis-consejos' }, async $ => {
    consejos = !consejos
    await $.store.set('consejos', consejos)
    await update($, guia, (g): GuiaState => ({ ...g, activa: consejos }))

    return { text: consejos ? 'Jarvis volverá a recomendarte skills.' : 'Jarvis deja de recomendarte skills.' }
  })

  // Lo que la persona elige se guarda para las próximas veces
  on('tool.check', { tool: RECORDAR }, () => ({ decision: 'allow' }))
  on('tool.call', { tool: RECORDAR }, async ($, e) => {
    await recordar($, e as unknown as Eleccion)

    return { result: 'Preferencia guardada.' }
  })

  // La forma de trabajar de Jarvis va en el prompt del sistema
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!consejos || e.traits.includes('bare') || e.traits.includes('teammate')) return composed

    return { sections: [...composed.sections, { id: 'jarvis-orb:guia', text: GUIA, scope: 'session' as const }] }
  })

  // Cada mensaje de la persona: busca temas, llena el panel y deja una pista a Claude
  on('prompt.submit', async ($, e, next) => {
    // Un mensaje que empieza por «Jarvis» se responde en voz alta
    if (!e.command && !e.isMeta && !NO_PERSONA.has(e.origin?.kind)) aJarvis = /^\W*jarvis\b/.test(normal(e.text))

    // «jarvis estatus» funciona aunque los consejos estén apagados
    if (!e.command && pideEstatus(e.text)) {
      return next({ ...e, context: [...(e.context ?? []), PISTA_ESTATUS] })
    }
    if (!consejos || e.command || e.isMeta || NO_PERSONA.has(e.origin?.kind)) return next(e)

    const usos = await leerUsos($)
    const temas = temasPara(e.text)
    const sugerencias = sugerenciasDe(temas, usos, await leerPreferencias($))
    await update($, guia, (g): GuiaState => ({
      ...g,
      tema: temas[0]?.titulo ?? null,
      sugerencias,
      mejora: temas[0]?.mejora ?? null,
      sinEstrenar: sinEstrenar(usos),
    })).catch(() => {})
    if (temas.length === 0) return next(e)

    return next({ ...e, context: [...(e.context ?? []), pista(temas, sugerencias)] })
  })

  // Memoria de uso: cada skill cargada, por comando o por Claude
  on('skill.prompt', async ($, e, next) => {
    await contar($, e.skill).catch(() => {})

    return next(e)
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
    if (e.tool === 'Agent' && e.subagent_type) await contar($, e.subagent_type).catch(() => {})
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
    if (e.reason === 'answer' && (modoVoz || aJarvis)) void speak($, answer.text, options)

    return answer
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const state = await read($, orb)
    const consejo = await read($, guia)
    const label =
      state.phase === 'tool' && state.tool ? `${LABEL.tool} · ${state.tool}` : LABEL[state.phase]
    const detail =
      state.tools > 0 ? `${state.tools} herramienta${state.tools === 1 ? '' : 's'} en este turno` : ''
    const panelGuia = consejo.activa && (
      <Box flexDirection="column" marginTop={1}>
        {consejo.tema && <Text bold>{`PARA ESTO · ${consejo.tema}`}</Text>}
        {consejo.sugerencias.map(s => (
          <Text>{`${comando(s)}: ${s.para}${historial(s) && ` (${historial(s)})`}`}</Text>
        ))}
        {consejo.mejora && <Text dimColor>{`Pídelo mejor: ${consejo.mejora}`}</Text>}
        {consejo.sinEstrenar && (
          <Text dimColor>{`Sin estrenar: ${comando(consejo.sinEstrenar)}, ${consejo.sinEstrenar.para}`}</Text>
        )}
        <Text dimColor>{`${consejo.usadas} usadas · /jarvis-skills para verlas todas`}</Text>
      </Box>
    )

    // El terminal no dibuja SVG: ahí basta con el estado en texto
    if (!('Svg' in ui)) {
      return (
        <Box flexDirection="column">
          <Text bold>{TITLE}</Text>
          <Text dimColor={state.phase === 'idle'}>{label}</Text>
          {detail && <Text dimColor>{detail}</Text>}
          {panelGuia}
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
        {panelGuia}
      </Box>
    )
  })
}
