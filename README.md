# J.A.R.V.I.S. Orb para Claude Code

Un panel junto al chat de Claude Code con una esfera holográfica cian al estilo Jarvis:

- **En espera:** los anillos y la malla giran despacio y el núcleo late suave.
- **Mientras Claude piensa:** gira más rápido y brilla más («PROCESANDO…»).
- **Mientras usa una herramienta:** aún más rápido, con el nombre de la herramienta («EJECUTANDO · Bash») y cuántas lleva en el turno.

El comando `/jarvis` vuelve a abrir el panel.

## Voz de Jarvis (opcional)

Con una clave de ElevenLabs, el mod lee cada respuesta en voz alta con la voz Jarvis (en español y en inglés), y la esfera pasa a «HABLANDO». `/jarvis-voz` lo apaga y lo enciende durante la sesión. Se calla al enviar un mensaje nuevo.

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
