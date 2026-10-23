# Apps de la comunidad (YouTube sin anuncios, Kodi, Jellyfin, Moonlight…)

FreeTV lee el catálogo de [webOS Homebrew](https://repo.webosbrew.org) (el proyecto comunitario de apps para LG) y te deja
**ver todas** desde la tele e **instalar** **las que no necesitan root**. Hoy son **36 de 56**.

- **En la tele:** *Ajustes de inicio → Apps de la comunidad*. Lista cada app («sin root» o «root»), y con OK ves su ficha: qué es,
  qué necesita, dónde está su código y, si tu ordenador está conectado (siguiente apartado), el botón **Instalar en esta tele**.
- **En el ordenador:** `python3 tools/community.py` (solo necesita Python 3).

## Instalar desde la tele (la «tienda»), sin ordenador

En el estante de FreeTV hay un icono **Tienda** (la app número 9: se añade una sola vez a tu estante, y lo puedes quitar o
moverlo como cualquier otro). También está en *Ajustes de inicio → Apps de la comunidad*. Abre la lista; con OK ves la ficha de
una app y, si no pide root, el botón **Instalar en esta tele**. Te pide confirmación (las apps con aviso enseñan su aviso y la
pantalla empieza en **Cancelar**), y **la propia tele** descarga el paquete, comprueba su hash SHA-256 y lo instala. Mientras
instala va diciendo cada paso, y la app nueva aparece al momento en FreeTV.

**Cómo es posible sin root.** Una app o un servicio de la tele **no tienen permiso para llamar al instalador de LG** (la tele responde
`Denied method call`; lo medimos). Pero una sesión de Modo Desarrollador **sí**: es lo que usa `ares-install` desde el ordenador. Y
el SSH del Modo Desarrollador de tu tele también contesta *desde la propia tele* (`127.0.0.1:9922`). El servicio de la tienda
(`store-service/`, dentro del paquete de FreeTV) abre esa sesión consigo mismo y ejecuta los mismos comandos que `ares-install`: el
`curl` de la tele descarga, `sha256sum` comprueba, `luna-send-pub` instala, y se mira la lista de apps para confirmar que está.

**Qué hay que darle, una sola vez.** Para abrir esa sesión el servicio necesita **la clave del Modo Desarrollador de esa tele**,
la misma que ya usa tu ordenador. `bash install.sh <IP>` te lo **pregunta** (por defecto, no) con la explicación. Si dices que sí,
`tools/provision_store.js` la copia por el canal SSH cifrado a la carpeta del servicio (`.../com.gathin.tvhome.store/state/key.pem`,
legible solo por el grupo de Modo Desarrollador), la comprueba por hash y **no la imprime nunca**; la contraseña de la clave no sale
del ordenador. Para retirarla:

```bash
node tools/provision_store.js 192.168.1.140 --forget
```

Qué puede hacer quien tuviera esa clave en la tele: lo mismo que hace tu ordenador (instalar y quitar apps del Modo Desarrollador),
no más. Si no la das, la tienda funciona igual **a través del ordenador** (siguiente apartado).

**Qué rechaza** (probado en una tele real): apps que piden root; un paquete sin hash o con hash distinto; un id que no está en el
catálogo; caracteres de shell en el id; una dirección de descarga con comillas; un aviso sin confirmar; y una segunda instalación a la vez.

Si dice que no puede abrir el Modo Desarrollador: comprueba que está **activado** (si caducó, la tele borra las apps de desarrollador)
y, si lo reinstalaste, vuelve a ejecutar `bash install.sh <IP>`: la clave cambia con él.

### Alternativa: a través del ordenador (`serve`)

Si no quieres dar la clave a la tele, puedes dejar el ordenador encendido y que la tele le pida las instalaciones. El ordenador hace el
trabajo de siempre (descarga, hash, `ares-install`):

```bash
python3 tools/community.py serve 192.168.1.140     # la IP de tu tele; déjalo abierto mientras instalas
```

1. El comando abre en la tele la pantalla *Apps de la comunidad* y le dice dónde está el ordenador (nadie escribe direcciones con el mando).
2. En la ficha de una app **sin root** aparece **Instalar en esta tele**; el resto es igual.

Solo atiende a **la dirección de la tele**; exige una cabecera que una página web no puede mandar por su cuenta; la tele solo manda el
**identificador** (el ordenador busca la app en el catálogo); una instalación cada vez. Con `--no-launch` no abre la tele al
arrancar; con `--port N` cambia el puerto (8777). Si la tele no encuentra el ordenador, puedes poner su dirección en `community_host=`
de `config.properties` y volver a ejecutar `bash install.sh <IP>`; el cortafuegos del ordenador debe dejar entrar al puerto 8777.

### Con la línea de comandos

```bash
python3 tools/community.py list                          # las que se pueden instalar sin root
python3 tools/community.py list --all                    # también las que piden root (no se instalan)
python3 tools/community.py info org.xbmc.kodi            # ficha: versión, código, requisitos, hash
python3 tools/community.py install org.xbmc.kodi 192.168.1.140
python3 tools/community.py remove  org.xbmc.kodi 192.168.1.140
python3 tools/community.py serve   192.168.1.140        # instalar desde la pantalla de la tele
```

Hace falta haber instalado FreeTV antes (`bash install.sh <IP>`): deja las herramientas de LG y el perfil de tu tele.

## Qué hace para ser seguro

1. **Solo sin root.** Si el catálogo dice que una app necesita root, `install` se niega. FreeTV no hace root a ninguna tele.
2. **Comprueba el hash.** Descarga el paquete, calcula su SHA-256 y lo compara con el del catálogo. Si falta o no coincide, **lo borra
   y no instala nada**. (Lo probamos con un hash falso: lo rechaza.)
3. **Te enseña lo que va a instalar** (nombre, versión, dónde está su código, dirección de descarga) y **te lo pregunta**
   (en la terminal, o en la pantalla de la tele con `serve`). `--yes` salta la pregunta, para scripts.
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
**propia tienda** (la pantalla de arriba, con el instalador de `serve`) y el instalador con comprobación de hash, que hacen lo útil sin root.

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
en `home/home.js`; el instalador es `tools/community.py`. Los avisos extra están **en los dos sitios** (`CAUTION` y `COMM_CAUTION`,
y la bandera de cada uno en `COMM_FLAG`): si cambias uno, cambia los otros.

`serve` es un servidor HTTP mínimo (`/ping`, `/status`, `POST /install?id=…&flag=…`) en la dirección del ordenador que da la ruta hacia la
tele. Lo arranca con `ares-launch com.gathin.tvhome -p {"storeHost","storePort","n"}`: la pantalla lee esos parámetros (`PalmSystem.launchParams`
al arrancar, `webOSRelaunch` si ya corría), solo acepta direcciones privadas y recuerda el último `n` para no reabrirse con parámetros viejos.
**Esa parte (los parámetros de lanzamiento y la tienda en una tele real) no la hemos probado aún en una tele**: se probó el servidor con
herramientas `ares` simuladas y la pantalla en un navegador.
