# Android TV y Google TV (Sony Bravia y demás): FreeTV

> **Estado (FreeTV 2.15):** `android/` es la app de Free My TV (MIT, con su crédito) con **la misma pantalla de FreeTV** que
> en LG y Samsung dentro (un WebView con `home/`), más **Stremio Claude** en el estante: si no está en la tele, FreeTV lo
> instala desde su versión de GitHub (comprueba su huella SHA-256 y Android pide confirmarlo), y las sugerencias lo abren por
> defecto. Compilada y probada en un navegador con una tele simulada; **todavía no en una Bravia de verdad**. La pantalla
> nativa de Free My TV sigue dentro como aspecto «clásico». Si la pruebas, cuéntanos en una *Issue* qué tele y cómo fue.
>
> Lo que en Android TV **no** hay (como en Samsung): la Tienda de webOS, Continuar viendo con Stremio, Jellyfin y Plex, la
> memoria y la renovación del Modo Desarrollador. Todo eso vive en el servicio que solo existe en LG.

Es una pantalla de inicio que **sustituye** a la de tu Google TV o Android TV, más una app de ajustes que cambia entre *Free My
TV* y el inicio original de la tele. Usa `adb` para **desactivar** (nunca desinstalar) las apps de publicidad del fabricante;
el modo *Original* lo devuelve todo.

## Qué necesitas

- Una **Google TV o Android TV** (Sony, TCL, Xiaomi, Philips, Hisense, onn, Chromecast con Google TV…), en la misma red.
- **JDK 17 o más**, las herramientas de línea de comandos del **SDK de Android** (build-tools 34+, plataforma android-34) y
  `adb`. En Windows, usa Git Bash o WSL.
- Opcional: tu clave de TMDB (tuya y secreta; en `config.properties`, nunca en un chat ni en GitHub).

## Pasos

1. En la tele: **Ajustes → Acerca de**, pulsa varias veces *Compilación* para activar las **Opciones de desarrollador**, y
   activa la **depuración por red/USB**.
2. En el ordenador, desde la carpeta `android/`:

```bash
cd android
bash build.sh                       # la primera vez crea config.properties: pon tu ciudad (latitude, longitude, city), tmdb_region...
bash build.sh                       # debe acabar en: Built FreeMyTV.apk
adb connect 192.168.1.50:5555    # la IP de tu tele; la tele pregunta «¿Permitir depuración?»: acepta y marca «Siempre»
adb install -r FreeMyTV.apk
```

3. **En la tele** (no desde el ordenador): abre *FreeTV* → **Pantalla de inicio (Home Screen) → Free My TV**. La app usa el `adb` de la propia tele y
   te pedirá permiso una vez más. Antes de cambiar, lee qué hace: cambia el inicio y el salvapantallas, **desactiva** una
   lista corta de apps promocionales y *Original* lo devuelve todo.
4. Para ver qué hizo: `adb logcat -s FreeMyTV`.

## Avisos importantes

- **Guarda `freemytv.keystore`**: las actualizaciones deben ir firmadas con la misma clave. **Nunca** lo subas a GitHub (está
  en `.gitignore`).
- **No desactives** apps que guardan redes wifi: Android borraría la red y *Original* no podría restaurarla.
- En **TCL**, para que el cambio funcione: `adb shell "appops set io.freemytv AUTO_START allow || appops set io.freemytv APP_AUTO_START allow"`.
  Los botones de Netflix/YouTube/Prime del mando funcionan en TCL, Vestel, KTC y Sony con un pequeño servicio de accesibilidad
  que solo lee esos botones (*Free My TV → Botones del mando*).
- En **Mac**, si `adb connect` da *No route to host*, permite a tu terminal en *Ajustes → Privacidad → Red local*.
- Si desinstalas la app **estando** en modo Free My TV, las apps desactivadas siguen desactivadas: reactívalas con
  `adb shell pm enable <paquete>`.
- Si la tele es un modelo antiguo (Android 8 a 11), usa una versión más ligera de la pantalla automáticamente.

## Créditos

Todo el código de `android/` es de [Free My TV](https://freemytv.io) (MIT, `licenses/Free-My-TV-MIT.txt`).
