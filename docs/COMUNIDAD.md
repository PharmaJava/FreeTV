# Apps de la comunidad (YouTube sin anuncios, Kodi, Jellyfin, Moonlight…)

FreeTV lee el catálogo de [webOS Homebrew](https://repo.webosbrew.org) (el proyecto comunitario de apps para LG) y te deja
**ver todas** desde la tele e **instalar** desde el ordenador **las que no necesitan root**. Hoy son **36 de 56**.

- **En la tele:** *Ajustes de inicio → Apps de la comunidad*. Es solo lectura: lista cada app («sin root» o «root»), y con OK ves
  su ficha: qué es, qué necesita, dónde está su código y el comando para instalarla.
- **En el ordenador:** `python3 tools/community.py` (solo necesita Python 3).

```bash
python3 tools/community.py list                          # las que se pueden instalar sin root
python3 tools/community.py list --all                    # también las que piden root (no se instalan)
python3 tools/community.py info org.xbmc.kodi            # ficha: versión, código, requisitos, hash
python3 tools/community.py install org.xbmc.kodi 192.168.1.140
python3 tools/community.py remove  org.xbmc.kodi 192.168.1.140
```

Hace falta haber instalado FreeTV antes (`bash install.sh <IP>`): deja las herramientas de LG y el perfil de tu tele.

## Qué hace para ser seguro

1. **Solo sin root.** Si el catálogo dice que una app necesita root, `install` se niega. FreeTV no hace root a ninguna tele.
2. **Comprueba el hash.** Descarga el paquete, calcula su SHA-256 y lo compara con el del catálogo. Si falta o no coincide, **lo borra
   y no instala nada**. (Lo probamos con un hash falso: lo rechaza.)
3. **Te enseña lo que va a instalar** (nombre, versión, dónde está su código, dirección de descarga) y **te lo pregunta**.
   `--yes` salta la pregunta, para scripts.
4. **Avisos extra** en tres casos, con una bandera que tienes que escribir a propósito (más abajo).
5. Solo habla con `repo.webosbrew.org` y con la dirección `https` del paquete que el propio catálogo publica.

El catálogo y las apps las hacen **otras personas**: lee la ficha y el código de una app antes de instalarla. FreeTV no las revisa ni
las mantiene; solo transmite lo que el catálogo publica.

## Las que te pueden interesar (todas sin root)

| App | Para qué | Nota |
|---|---|---|
| **YouTube AdFree** (`youtube.leanback.v4`) | YouTube sin anuncios, con SponsorBlock | **Reemplaza al YouTube oficial** (ver abajo) |
| **Kodi** (`org.xbmc.kodi`) | Centro multimedia | webOS 4 o más; no en los chips «k5lp» |
| **Jellyfin** (`org.jellyfin.webos`), Moonfin, Litefin, Breezyfin | Tu biblioteca multimedia (servidor Jellyfin) | webOS 5 o más |
| **PlxNative** (`com.beb.plxnative`) | Plex con reproductor nativo | webOS 4 o más |
| **Moonlight** (`com.limelight.webos`) | Jugar a tu PC por la red (NVIDIA/Sunshine) | |
| **RetroArch** (`com.retroarch.webos`) | Emulación de consolas retro | Depende de tu tele y de tus mandos |
| **Qoder IPTV Player**, **TVHeadend Client** | IPTV y TDT desde tu servidor | Necesitas tu propia lista o servidor |
| **Twitch AdFree**, SmartTwitchWebOSTV | Twitch | |
| **Immich** / Immich TV | Tus fotos (servidor Immich) | |
| **Crunchyroll**, BiliTV | Streaming de anime | |

Mira la lista completa con `python3 tools/community.py list`.

## Los tres avisos extra

- **`--official-removed` (YouTube AdFree).** Usa el mismo identificador que el YouTube de LG, así que **antes hay que borrar el
  oficial, y solo se puede hacer en la tele**: en el inicio de LG, mantén **OK** sobre YouTube y elige *Eliminar* (se puede volver
  a poner desde la **LG Content Store**). **Desde el ordenador no se puede**, y si instalas con la oficial puesta la tele dice
  «Success» pero la oficial se queda sin su acceso directo y la nueva no se instala (nos pasó). Cuando la hayas borrado:
  `python3 tools/community.py install youtube.leanback.v4 <IP> --official-removed`. Quita anuncios, y eso puede ir contra las
  condiciones de uso de YouTube: es tu decisión. Al abrirla, la **tecla verde** del mando abre su configuración.
- **`--sensitive` (Open Service Menu).** Abre el menú de servicio oculto de LG; cambiar ahí cosas puede estropear la tele y anular
  la garantía.
- **`--sensitive` (Auto Dev Token Refresh).** Renueva el Modo Desarrollador por su cuenta. FreeTV ya trae su propio panel de
  renovación (beta): no hace falta usar los dos.
- **`--sensitive` (Homebrew Channel).** Ver siguiente apartado.

## Espacio, y borrar apps de LG

Las apps ocupan la partición de apps de la tele, que suele estar casi llena (en nuestra LG OLED B1: 2,3 GB con 53 MB libres).
**Kodi** (paquete de 94 MB, bastante más ya descomprimido) **no cupo ni con 159 MB libres**: la tele responde «There is no
available space to install App». Jellyfin, YouTube AdFree y casi todas las demás son pequeñas.

**Las apps de LG y las de la tienda no se pueden quitar desde el ordenador** (`FAILED_REMOVE`): hay que borrarlas en la tele,
manteniendo **OK** sobre ellas en el inicio de LG. Candidatas habituales: apps promocionales (8 Ball Pool, SkyShowtime, LG Sports
Playbook, LG Gaming Portal, LG Radio+, LG Movies & TV, RT News…) y las que no uses (Apple TV ocupa 48 MB).
`tools/community.py` te avisa del espacio libre antes de instalar.

## Lo que NO se instala: root y el Homebrew Channel

**Root** es saltarse la seguridad de la tele para tener control total. Lo necesitan **20 apps** del catálogo (Hyperion y PicCap para
iluminación ambiental, VNC, VPN WireGuard, salvapantallas «Aerial», WebOS Terminal, bloqueador de actualizaciones…) y las
funciones más potentes del **Homebrew Channel**.

FreeTV **no hace root ni lo recomienda**: puede dejar la tele sin arrancar o sin garantía, cada modelo y versión de firmware es
distinto y se puede perder lo que hoy funciona. El Homebrew Channel, sin root, **sirve de poco**: su tienda se puede instalar, pero
sus funciones importantes (ejecutar como root, ajustes de arranque, acceso SSH) necesitan una tele rooteada. Por eso FreeTV trae su
**propia tienda de lectura** (la pantalla de arriba) y el instalador con comprobación de hash, que hacen lo útil sin root.

Si de todos modos quieres investigarlo por tu cuenta, la documentación de referencia es la del proyecto
(https://www.webosbrew.org) y la compatibilidad por modelo se mira en https://cani.rootmy.tv. **FreeTV no lo ha probado y no da
soporte a teles rooteadas.**

## Sobre la lista que te dio ChatGPT

Revisamos sus enlaces contra el catálogo real: varias apps de esa lista **necesitan root** (PicCap, Hyperion, VNCServer, Aerial,
WireGuard, LG Input Hook) y no se instalan; otras sí están y sin root (YouTube AdFree, Kodi, Jellyfin, Moonlight, PlxNative,
RetroArch). Una (el reproductor IPTV de lennylxx) no aparece en el catálogo y no la hemos podido verificar, así que no está incluida.

## Para quien programa

El catálogo es `https://repo.webosbrew.org/api/apps.json` (permite leerlo desde la propia pantalla). Cada app trae
`manifest.rootRequired`, `manifest.ipkUrl`, `manifest.ipkHash.sha256` y `requirements`. El código de la pantalla es `openCommunity()`
en `home/home.js`; el instalador es `tools/community.py`. Los avisos extra están **en los dos sitios** (`CAUTION` y `COMM_CAUTION`):
si cambias uno, cambia el otro.
