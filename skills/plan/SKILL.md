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

## 3. Organiza por pasos

Usa los pasos que tenga el proyecto, por ejemplo:

- **Vídeo o reel:** guion, explicación, voz, montaje, subtítulos, publicación.
- **Diapositivas:** estructura, contenido, diseño, revisión.
- **Investigación:** búsqueda de fuentes, lectura, síntesis, entrega (documento, diapositivas o vídeo).

En cada paso, dos o tres candidatos con una frase sencilla sobre qué hacen y qué aportan aquí.

## 4. Deja que elija

Usa AskUserQuestion, una pregunta por paso (máximo cuatro preguntas, con multiSelect). Cada opción lleva de label el /comando, «agente X» o «conector X», y en la descripción qué hace. Incluye «Sin nada» en cada paso.

## 5. Recuerda y trabaja

Llama a `mcp__jarvis-orb__recordar_eleccion` por cada paso, con el tema, lo elegido y lo descartado. Después carga solo lo elegido y haz el trabajo.
