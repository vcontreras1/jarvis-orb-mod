# J.A.R.V.I.S. Orb para Claude Code

Un panel junto al chat de Claude Code con una esfera holográfica cian al estilo Jarvis, que además te guía por tus skills y agentes:

- **En espera:** los anillos y la malla giran despacio y el núcleo late suave.
- **Mientras Claude piensa:** gira más rápido y brilla más («PROCESANDO…»).
- **Mientras usa una herramienta:** aún más rápido, con el nombre de la herramienta («EJECUTANDO · Bash») y cuántas lleva en el turno.

El comando `/jarvis` vuelve a abrir el panel.

## Guía de skills y agentes

Jarvis te enseña qué tienes instalado y tú decides qué usar:

- **En cada petición con trabajo real** te pregunta qué skills o agentes quieres usar, con una frase que explica cada uno. No carga nada que no hayas elegido.
- **El panel** muestra las mismas opciones y cómo pedirlo mejor.
- **Aprende de ti:** guarda por tema qué eliges y qué descartas, entre sesiones, y pone delante lo que sueles elegir.
- **Te recuerda lo que no has probado:** en cada petición te propone algo sin estrenar.

Para un proyecto (vídeo, reel, diapositivas o investigación), Claude carga la skill `jarvis-orb:plan`, que propone qué skill, agente o conector usar en cada paso. También puedes pedirla tú con `/jarvis-orb:plan`.

`/jarvis-skills` muestra la chuleta completa y `/jarvis-skills video` el detalle de un tema. `/jarvis-consejos` lo apaga y lo enciende.

Los temas están en `CATALOGO`, en `hooks/register.tsx`. Las palabras clave son simples: si un tema no salta, Claude sigue viendo la lista completa de skills.

## Jarvis estatus

Cada 15 días, una tarea programada propone 5 skills, conectores o plugins según tus proyectos y tus elecciones. No instala nada. Guarda el informe en `~/.claude/jarvis/estatus.md` y en el Google Doc «Jarvis estatus».

Di o escribe `jarvis estatus` y Jarvis te lo lee en voz alta. Sin clave de ElevenLabs usa la voz del Mac.

## Voz de Jarvis (opcional)

Jarvis habla cuando le hablas a él: si tu mensaje empieza por «Jarvis», responde en voz alta con la voz de ElevenLabs (en español y en inglés) y la esfera pasa a «HABLANDO». Si se acaban los créditos o no hay clave, usa una voz gratis: Piper si está instalado y, si no, la voz del Mac. `/jarvis-voz` hace que lea todas las respuestas de la sesión. Se calla al enviar un mensaje nuevo.

Necesita un Mac con `curl` y `afplay`. Gasta un crédito de ElevenLabs por carácter leído; `max_caracteres` y el modelo `eleven_flash_v2_5` ayudan a gastar menos. Crea la clave en ElevenLabs con permiso solo de Text to Speech y guárdala en tu terminal, sin que se muestre:

```bash
read -s KEY; printf '{"elevenlabs_api_key":"%s"}' "$KEY" | claude plugin configure jarvis-orb@jarvis-orb-mod --values-stdin; unset KEY
```

La clave se guarda en el almacenamiento seguro del sistema, nunca en este repositorio. Sin clave, el mod solo muestra la esfera.

## Instalación

En el prompt de una sesión de Claude Code en el terminal:

```
/plugin install jarvis-orb --marketplace vcontreras1/jarvis-orb-mod
```

Desde una terminal:

```
claude plugin install jarvis-orb --marketplace vcontreras1/jarvis-orb-mod
```

En la app de escritorio, donde `/plugin` no está disponible: pulsa **+** junto a la caja de escribir, luego **Plugins**, **Add marketplace** con `vcontreras1/jarvis-orb-mod`, y después **Add plugin**.

Al instalar, responde `y` a «Add marketplace?» y elige el ámbito de usuario.
