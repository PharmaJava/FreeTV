# Otras teles: qué funciona dónde

FreeTV nació en una **LG OLED** y ahí es donde está probado de verdad. Para que no tengas que adivinar, esta es la
situación honesta de cada tipo de tele:

| Tele | Qué hay en este repositorio | Estado |
|---|---|---|
| **LG (webOS)** | FreeTV completo: pantalla nueva, botón Home, Atrás, renovación, sugerencias, mercados… | **Probado** en una LG OLED (`bash install.sh <IP>`) |
| **Samsung (Tizen 3 o más: 2017 en adelante)** | La **misma pantalla** de FreeTV (iconos, sugerencias, mercados, reordenado) empaquetada con las herramientas de Free My TV (`tizen/`) | **Experimental**: la instalación por red es la de Free My TV, probada allí en Samsung de 2017 y 2019; FreeTV como tal **no lo hemos probado en ninguna Samsung**. Guía: [SAMSUNG.md](SAMSUNG.md) |
| **Android TV / Google TV** (Sony, TCL, Xiaomi, Philips, Hisense, onn, Chromecast con Google TV…) | La app **Free My TV para Android** (`android/`), tal cual la publicó su equipo | **Incluida sin cambios**: no la hemos compilado ni probado aquí. No lleva las novedades de FreeTV (menú Sugerencias, reordenado con OK, fila de 18…). Guía: [ANDROID-TV.md](ANDROID-TV.md) |
| Samsung antiguas (hasta 2016) | Nada | **No se puede**: la tele no ofrece el Modo Desarrollador. Mira «Alternativa» abajo |
| Fire TV, Roku, Apple TV | Nada | No soportado |

## Alternativa para cualquier tele (incluidas las que no se pueden)

Un **reproductor Google TV por HDMI** (Chromecast con Google TV, Google TV Streamer, onn 4K, NVIDIA Shield) convierte
cualquier tele en una Android TV. Con uno de esos puedes usar la app de `android/`, que sí está pensada para ellos.

## Por qué no hay lo mismo en todas

Cada fabricante tiene su sistema y sus reglas:

- **LG** deja instalar apps propias con el Modo Desarrollador y, con un ayudante, abrir una al pulsar Home.
- **Samsung** deja instalar apps firmadas con un certificado, pero **ninguna app puede quitarle el botón Home** a Samsung. Aquí
  FreeTV es una app que abres tú (puedes poner *Autorun Last App* en los ajustes de la tele para que arranque al encender).
- **Android TV** permite cambiar la pantalla de inicio por otra, pero lo hace con comandos `adb` que desactivan apps del
  fabricante (nunca las desinstala; hay modo *Original* para volver).

## ¿Tienes una de estas teles y quieres probar?

Abre una *Issue* en https://github.com/PharmaJava/FreeTV/issues con el **modelo exacto**, qué hiciste y qué pasó (sin tu
passphrase, sin claves, sin contraseñas). Cada prueba real que se cuente aquí sube un escalón el estado de la tabla.
