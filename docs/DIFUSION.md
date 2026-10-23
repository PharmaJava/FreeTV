# Cómo dar a conocer FreeTV

Textos listos para copiar, y consejos para que la gente lo encuentre y se fíe. **Los publicas tú, con tu cuenta**: ahí tú decides
dónde y cuándo. Sé siempre honesto con lo probado: es lo que hace que una comunidad te crea.

## Lo que más ayuda a que el repositorio se encuentre

- **Una buena captura o un vídeo corto** en el README (hecho con el móvil a la tele: abrir, mover un icono, salir de una app).
- **Temas (topics) y descripción** del repositorio en GitHub (ya puestos; se cambian en ⚙ junto a *About*).
- **Un *Release*** con notas claras cada vez que haya cambios importantes.
- **Cuéntalo donde ya se habla de esto**, sin spam: foros y comunidades de LG webOS, Android TV, domótica y privacidad.
  Responde a quien pregunte.
- **Pide pruebas**: «¿Lo has probado en tu modelo? Cuéntalo en una Issue». Cada modelo confirmado hace el proyecto más fiable.
- **Cuida los créditos**: menciona a Free My TV y a Razdva122. Es lo correcto y además les trae gente a ellos.

## Texto corto (para una publicación o un mensaje)

**Español**

> Acabo de publicar **FreeTV**, código abierto: una pantalla de inicio limpia y sin publicidad para tu tele LG (webOS), con un
> botón Home que te lleva siempre a ella. Iconos de app de verdad, recomendaciones solo de los servicios donde tienes cuenta,
> el tiempo, cotizaciones (cripto, S&P 500, NASDAQ 100) y renovación del Modo Desarrollador. Sin root, y se deshace todo.
> Probado en una LG OLED; Samsung (experimental) y Android TV incluidos. Hecho sobre Free My TV y el ayudante de
> Razdva122. https://github.com/PharmaJava/FreeTV

**English**

> I just published **FreeTV**, open source: a clean, ad-free home screen for LG (webOS) TVs, plus a Home button that always
> takes you to it. Real app icons, suggestions only from the services you have accounts in, weather, quotes (crypto, S&P 500,
> NASDAQ 100) and Developer Mode renewal. No root, fully reversible. Tested on an LG OLED; Samsung (experimental) and
> Android TV included. Built on Free My TV and Razdva122's helper. https://github.com/PharmaJava/FreeTV

## Texto largo (para un foro o una comunidad)

**Título:** FreeTV: inicio limpio para LG webOS con botón Home propio (sin root)

**Cuerpo:**

> Llevaba tiempo harto de la publicidad en el inicio de mi LG OLED y he montado **FreeTV**:
>
> - Pantalla de inicio propia: iconos cuadrados como los de la tele, estante de 12 apps que se reordena manteniendo OK,
>   sugerencias de películas y series **solo de los servicios que activas** (sin Disney+ si no tienes cuenta), el tiempo y
>   cotizaciones.
> - **Botón Home y Atrás** te llevan a ella (con el ayudante de Razdva122, al que he arreglado dos cosas: no arrancaba con
>   el Node 8 de mi tele y había un vaivén al salir de una app).
> - Se instala con el **Modo Desarrollador** de LG, sin root, y se quita igual de fácil. Mantener Home 2 segundos vuelve al inicio de LG.
> - Hay guía paso a paso (también para hacerlo con cualquier IA si no sabes programar).
>
> Lo he probado en **una LG OLED**; para Samsung y Android TV el repositorio incluye lo de Free My TV, pero **no lo he probado
> yo**. Si lo pruebas en otro modelo, abre una Issue y cuéntame qué tal.
>
> https://github.com/PharmaJava/FreeTV · Créditos: Free My TV (pantalla) y Razdva122/clean-your-tv-lg-webos (ayudante).

## Antes de publicar, revisa

- [ ] La captura del README **no** muestra datos tuyos (la actual solo enseña carátulas y apps).
- [ ] `python3 tools/check_secrets.py --all` dice «No keys or private files found».
- [ ] Has probado una instalación limpia en un clon nuevo (`FREETV_PREPARE_ONLY=1 bash install.sh <IP>`).
- [ ] Respondes a las *Issues* (aunque sea «gracias, lo miro»).
