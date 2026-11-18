---
name: plan
description: Plan de Jarvis para un proyecto (vídeo, reel, diapositivas o investigación). Dice, paso a paso, qué skills, agentes y conectores (MCP) usar, explica cada uno en una frase y deja que la persona elija. Úsala cuando encargue un proyecto o pregunte qué debería usar.
---

# Plan de Jarvis

La persona no recuerda qué hace cada skill, agente o conector y quiere elegir ella. Tú eres su especialista.

## 1. Entiende el encargo

Identifica el formato (vídeo horizontal, reel vertical, diapositivas, documento de investigación), el tema, el público y para cuándo. Pregunta solo lo que falte y cambie el plan.

## 2. Reúne candidatos reales

- Mira la lista de skills de esta sesión, los tipos de agente y los conectores conectados. Ofrece solo lo que existe ahora.
- Lee `~/.claude/jarvis/preferencias.json` si existe: pon delante lo que suele elegir para ese tema y al final lo que suele descartar.
- Lee `~/.local/share/voces-open-source/RANKING.md` si el proyecto lleva voz. Su voz por defecto es Piper Sharvard hombre.
- No va a pagar nada: primero lo gratis u open source. Marca «gasta créditos» o «necesita autorizarse» donde toque.
- Elige **una herramienta principal por tarea** y deja las demás como reserva. No propongas borrar ninguna por solaparse.
- Su saldo en cada servicio es desconocido: no lo supongas ni lo afirmes. Pregunta o comprueba antes de gastar.

## 3. Organiza por pasos

Usa los pasos que tenga el proyecto, por ejemplo:

- **Vídeo o reel:** investigar, escribir, preparar imágenes y voz, montar, revisar y aprender (ver «Ruta por defecto»).
- **Diapositivas:** estructura, contenido, diseño, revisión.
- **Investigación:** búsqueda de fuentes, lectura, síntesis, entrega (documento, diapositivas o vídeo).

En cada paso, dos o tres candidatos con una frase sencilla sobre qué hacen y qué aportan aquí.

## 4. Deja que elija

Usa AskUserQuestion, una pregunta por paso (máximo cuatro preguntas, con multiSelect). Cada opción lleva de label el /comando, «agente X» o «conector X», y en la descripción qué hace. Incluye «Sin nada» en cada paso.

## 5. Recuerda y trabaja

Llama a `mcp__jarvis-orb__recordar_eleccion` por cada paso, con el tema, lo elegido y lo descartado. Después carga solo lo elegido y haz el trabajo.

## Ruta por defecto para vídeo y reels

1. **Investigar.** Principal de prueba: Parallel Search. Reservas: Exa o Tavily si no hay cuota o el resultado no es bueno. Elicit si hacen falta estudios; Firecrawl para leer una web concreta.
2. **Escribir.** Claude para convertir la idea en guion; Google Docs para guardar la versión aprobada; Drive para fuentes y materiales.
3. **Imágenes y voz.** Material propio primero. Higgsfield solo si falta un plano (no es sustituible por otro igual: si no hay créditos, fotos propias y texto). Canva para portada o carrusel. Su voz, Piper o ElevenLabs para la narración.
4. **Montar: una ruta.** Habla a cámara → AI Producer. Mezcla clips y fotos → Picsart Media Studio. Texto y gráficos animados → HyperFrames. CapCut en el teléfono como alternativa manual o para retoques.
5. **Revisar y aprender.** Revisar el vídeo con la persona antes de publicar. Después, Metricool para resultados y Google Sheets para anotar qué repetir. Nunca programes ni publiques sin su visto bueno.

**Alternar sin perder trabajo:** guarda fuera de cada editor el guion aprobado, los clips y fotos originales, la narración, los subtítulos y el último MP4. Un MP4 no conserva capas; cambiar de editor puede exigir rehacer el montaje.

**Sus proyectos**
- **Espacio Futuro:** fuentes → Elicit si hay estudios → guion en Claude y Docs → imágenes reales o escenarios ilustrativos (Higgsfield) → montaje → revisión de fuentes.
- **Inka Xtreme:** material de marca → guion → Canva e Higgsfield solo si aportan algo → montaje → revisión de marca → resultados en Metricool.
- **Marca personal:** notas o grabaciones → transcripción (WhisperAI) si hace falta → guion → AI Producer si habla a cámara, o CapCut → revisión con la persona.

**Primer paso sencillo:** un guion corto de uno de los tres proyectos con su lista de materiales; después, una sola ruta de montaje y una alternativa según el material y las cuotas.
