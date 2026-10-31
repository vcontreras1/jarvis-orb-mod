# J.A.R.V.I.S. Orb para Claude Code

Un panel junto al chat de Claude Code con una esfera holográfica cian al estilo Jarvis:

- **En espera:** los anillos y la malla giran despacio y el núcleo late suave.
- **Mientras Claude piensa:** gira más rápido y brilla más («PROCESANDO…»).
- **Mientras usa una herramienta:** aún más rápido, con el nombre de la herramienta («EJECUTANDO · Bash») y cuántas lleva en el turno.

El comando `/jarvis` vuelve a abrir el panel. Es solo visual: no cambia cómo trabaja Claude.

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
