# Cómo funciona

FreeTV son **tres piezas** que trabajan juntas en tu tele:

```
 botón Home ──▶ Home Helper (servicio nativo) ──▶ abre la app FreeTV (com.gathin.tvhome)
                  │  escucha el mando                   │  HTML + JavaScript: la pantalla de inicio
                  └─ vigila qué app está delante        └─ servicio de renovación del Modo Desarrollador (beta)
```

1. **La pantalla FreeTV** (`home/`): una app web (HTML, CSS y JavaScript sin librerías) que se parece a la de Free My TV.
   Pide a la tele la lista de apps (se lee al instalar, con sus iconos), pinta el estante, las recomendaciones, el
   tiempo y las cotizaciones, y abre las apps con el servicio de la tele (`luna://com.webos.applicationManager/launch`).
2. **Home Helper** (de Razdva122, descargado al instalar): un programa pequeño que lee los botones del mando
   (`/dev/input`) y, cuando pulsas Home, abre FreeTV. También vigila qué app está delante, y si una app termina y LG pone su
   inicio, abre FreeTV. Mantener Home 2 segundos lo detiene.
3. **El servicio de renovación** (de Razdva122): el Modo Desarrollador de LG caduca; este servicio puede renovarlo con el
   servidor de LG, y es opcional y beta.

## Qué añade FreeTV

- **Pantalla (`home/`):** iconos cuadrados a todo el cuadro, estante de 12, reordenado manteniendo OK, cotizaciones de
  Bitcoin, Ethereum, Solana, S&P 500 y NASDAQ 100 (dólares), y recomendaciones por servicio con interruptores.
- **Dos arreglos al ayudante** (`tools/patch_helper.py`, se aplican al instalar):
  1. **`ws` 7.5.10 en lugar de `ws` 8.** El ayudante lleva una librería de WebSocket que necesita Node 10; algunas LG traen
     Node 8 y el ayudante **nunca llega a arrancar** (`SyntaxError: Unexpected token {` en su registro). `ws` 7.5.10 funciona
     en Node 8 y en los nuevos.
  2. **Reintento al volver de una app.** Al salir con **Atrás**, LG vuelve a poner su inicio un momento después de que el
     ayudante abra FreeTV. El ayudante ahora mira otra vez y vuelve a abrir FreeTV (hasta cinco veces, cada segundo).

El instalador (`install.sh`) usa una versión **fija** del ayudante (el commit está en el propio script) para que estos
arreglos encajen siempre; si el código del ayudante no es el esperado, el parche se detiene con un aviso.

## Dónde mirar si quieres cambiar algo

| Quiero… | Archivo |
|---|---|
| Cambiar colores, tamaños, estante | `home/home.css`, `home/home.js` (`renderShelf`, `SHELF_DROP`, `MAX_SHELF`) |
| Cambiar las cotizaciones | `home/data.js` (`FUNDS` y la sección *Prices*) |
| Cambiar de qué servicios se recomienda | `home/data.js` (`SERVICES`) |
| Cambiar la renovación o los avisos del botón Home | `home/renewal.js`, `home/extras.js` |
| Cambiar cómo se instala | `install.sh`, `tools/build_home.py`, `tools/patch_helper.py` |

Cada cambio se aplica volviendo a ejecutar `./install.sh <IP>`.

## Detalles técnicos útiles

- La pantalla es JavaScript **ES5** y CSS sin variables ni *grid*, para llevarse bien con teles antiguas. En la tele de pruebas
  corre Chrome 79 y Node 8.12 para los servicios.
- Las peticiones a Binance, Yahoo Finance, TMDB y Open-Meteo las hace la propia pantalla (la tele las permite); no hay
  servidor intermedio.
- El orden del estante, los interruptores y el idioma se guardan en el almacenamiento local de la app (`localStorage`).
  Al desinstalar la app se borran.
- Se pueden mirar los registros del helper con `ares-novacom` (ver [Problemas](PROBLEMAS.md)) y depurar la pantalla con
  `ares-inspect` (ver [`AGENTS.md`](../AGENTS.md)).
