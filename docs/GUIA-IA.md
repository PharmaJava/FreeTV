# Instalar FreeTV con la ayuda de cualquier IA

No necesitas Claude Code ni saber programar. Vale **ChatGPT, Gemini, Claude, Copilot, Mistral**… cualquiera que
entienda español. La IA no puede tocar tu tele ni tu ordenador: **te dice qué escribir y qué pulsar**, y tú le cuentas
qué ha salido.

## Antes de empezar: tres reglas de seguridad

1. **Nunca pegues en un chat tu passphrase del Modo Desarrollador, tu contraseña de LG ni tu clave de TMDB.** La IA no las
   necesita. La passphrase la escribes tú en la terminal, cuando el instalador la pida.
2. Si pegas lo que sale en la terminal, **revisa antes** que no lleve ninguna de esas tres cosas.
3. Haz solo lo que está en el [README](../README.md) o lo que esta guía te dice. Si la IA te propone otra cosa
   (rootear la tele, descargar «herramientas» de otras webs, desactivar seguridad), **para y pregunta**.

## Paso 1. Copia este texto y pégalo como primer mensaje

> Vas a ayudarme, paso a paso y con calma, a instalar **FreeTV** en mi televisor LG (webOS). FreeTV es un proyecto de
> código abierto que está en https://github.com/PharmaJava/FreeTV (el README explica todo). No soy técnico: explícame
> cada paso con palabras sencillas y dime exactamente qué escribir o pulsar, **de uno en uno**, esperando mi respuesta
> antes de seguir.
>
> Reglas: (1) Yo hago los pasos en la tele con el mando y en mi ordenador; tú no puedes verlos, así que pregúntame qué ha
> salido. (2) **Nunca me pidas mi passphrase del Modo Desarrollador, mi contraseña de LG ni mi clave de TMDB**: las escribo yo
> en mi terminal. Si algo que te pego las contiene, avísame de que las quite. (3) No me hagas rootear la tele, cambiar
> firmware, ni instalar nada que no esté en el README de FreeTV. (4) Si un comando da error, pídeme que te pegue el error
> (sin datos privados) y dime qué significa y qué probar. (5) Antes de cualquier paso que cambie la tele, dime qué va a
> pasar y cómo se deshace.
>
> Empieza preguntándome: qué sistema tiene mi ordenador (Windows, Mac o Linux), la IP de mi tele, mi ciudad y mi país, y si
> ya hice el Modo Desarrollador en la tele. Luego guíame por el README: Modo Desarrollador, preparar el ordenador
> (Windows necesita WSL con Ubuntu), clonar el repositorio, rellenar `config.properties` y ejecutar `bash install.sh <IP>`.

## Paso 2. Qué le contestas

La IA te preguntará cosas. Tienes que saber:

| Dato | Cómo lo sacas |
|---|---|
| **Sistema del ordenador** | Windows, Mac o Linux |
| **IP de la tele** | En la app *Developer Mode* de la tele, con el Key Server en ON, sale la IP. O en Ajustes → Red |
| **Ciudad, latitud y longitud** | Busca tu ciudad en un mapa en línea y copia los números (ej. Sevilla: 37.3891 y -5.9845) |
| **País** | Dos letras: ES, MX, AR, CO, US… |
| **Servicios sin cuenta** | Por ejemplo `disney` si no tienes Disney+. Los nombres: netflix, prime, disney, hulu, paramount, peacock, max, appletv, crunchyroll, globoplay |

## Paso 3. Cuando algo falla

Pega a la IA, **sin tu passphrase ni claves**:

- El **comando** que ejecutaste y las **últimas 20 líneas** de lo que salió.
- Qué esperabas que pasara y qué pasó en la tele.

Si la IA no lo resuelve, abre una *Issue* en https://github.com/PharmaJava/FreeTV/issues con ese mismo texto.

## Si quieres que la IA mire el código

Cualquier IA con acceso a archivos puede leer [`AGENTS.md`](../AGENTS.md) (un resumen técnico del proyecto) y
[`COMO-FUNCIONA.md`](COMO-FUNCIONA.md). Con eso puede ayudarte a cambiar colores, el número de apps del estante, el
texto, etc. Cualquier cambio en la pantalla es solo HTML, CSS y JavaScript en `home/`, y se aplica volviendo a ejecutar
`bash install.sh <IP>`.

## Si todo sale mal

- **Mantén el botón Home 2 segundos**: vuelves al inicio de LG.
- Para quitar FreeTV por completo, mira «Desinstalar» en el [README](../README.md).
- La tele siempre se puede dejar como estaba: FreeTV no cambia el firmware ni la configuración de LG.
