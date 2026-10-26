# FreeTV en Samsung (experimental)

> **Estado:** la pantalla es la de FreeTV y el instalador es el de Free My TV, que sus autores probaron en una Samsung de 2017
> (Tizen 3.0) y otra de 2019 (Tizen 5.0). **FreeTV como tal no lo hemos probado en ninguna Samsung**: lo hemos construido y lo
> hemos revisado en un navegador simulando una Samsung. Si lo pruebas, cuéntanos cómo fue (una *Issue*, sin claves).
> Las Samsung hasta 2016 **no sirven**: no tienen Modo Desarrollador.

En Samsung **ninguna app puede quitar el botón Home de Samsung**. FreeTV es una app que abres tú desde *Apps*. Si en los ajustes
de tu tele hay *Autorun Last App* (cambia de sitio según el año, suele estar en *Opciones de pantalla de inicio*), la tele
arrancará directamente en FreeTV. **No hay** botón Home personalizado, ni renovación (no hace falta), ni ayudante.

## Qué necesitas

- Una Samsung de **2017 o más** (Tizen 3 o más) en la misma red que tu ordenador.
- **Python 3** (para instalar) y las herramientas de Samsung (`tizen`, de Tizen Studio o del plugin
  [tizen-sdk-skills](https://github.com/Samsung/tizen-agent-skills)) para **firmar** el paquete.
- Un **certificado**: en teles de **2023 o más** hace falta un certificado de Samsung creado con **tu cuenta de Samsung** para
  esa tele (su DUID); en las de **2017 a 2022** vale un certificado de Tizen. Las contraseñas del certificado son tuyas: se
  escriben en **tu terminal**, nunca en un chat.

## En la tele

1. Pulsa **Home**, entra en **Apps**.
2. Con el mando, escribe **`1 2 3 4 5`**. Debe salir una ventana *Developer mode*.
3. Ponla en **On** y, en *Host PC IP*, escribe la **IP de tu ordenador**.
4. **Apaga la tele del todo y vuélvela a encender.**

(Si no sale la ventana, mira [PROBLEMAS.md](PROBLEMAS.md) y la nota de teles que no la tienen.)

## En el ordenador

```bash
cp config.example.properties config.properties     # pon tu ciudad (y tu clave de TMDB si quieres)
python3 tizen/build.py --sign <perfil>             # debe acabar en: Built FreeTV-tizen.wgt (..., signed with "<perfil>")
python3 tizen/install.py <IP de la tele>           # instala y abre la app
```

`<perfil>` es el nombre del perfil de seguridad que creaste con las herramientas de Samsung. Para quitarla:
`python3 tizen/install.py <IP> --uninstall` (si tu tele no responde a eso, bórrala en *Apps → Ajustes → FreeTV → Eliminar*).

Para actualizar, vuelve a construir y a instalar **con el mismo certificado**: la tele rechaza una actualización firmada con otro.

## Qué cambia respecto a LG

- Los iconos de apps de Samsung son logos (no cuadrados con fondo): se ven dentro del cuadro, sobre el color de cada marca.
- Sin **TV en directo** en el estante ni botón Home propio; sí tienes el cajón con las entradas HDMI y la TV.
- Las cotizaciones del S&P 500 y el NASDAQ 100 pueden no cargarse si la tele bloquea esas direcciones; Bitcoin y compañía sí.
- **Pestaña Personalizado:** los canales de YouTube se abren en el **YouTube de Samsung** (instálalo desde la tienda de Samsung si no
  lo tienes), con el vídeo más reciente del canal. `tizen/build.py` consulta los canales antes de empaquetar, como `install.sh` en LG
  (necesita internet; sin él, el canal abre YouTube sin ir al vídeo). Abrir el vídeo usa la petición «view» de Tizen con el vídeo en
  `PAYLOAD`: **no lo hemos probado en una Samsung**; si tu tele no la acepta, se abre YouTube a secas.
- Sin el **+** para añadir canales desde la tele (busca en YouTube con un servicio que solo existe en LG): añádelos en
  `config.properties` (`kids_channels=`) y vuelve a construir.
- Sin **Desinstalar** desde *Todas las apps*.

## Apps de la comunidad: TizenBrew (YouTube AdFree, Twitch AdFree y más)

En Samsung, las apps de la comunidad funcionan dentro de [TizenBrew](https://github.com/reisxd/TizenBrew), una app gratuita de la
comunidad que carga *módulos* publicados en npm o en GitHub. Se instala **una vez** con
[TizenBrew Installer](https://github.com/reisxd/TizenBrewInstaller) (en el ordenador o en un móvil Android; en las teles de 2023 o más
te pide entrar con tu cuenta de Samsung para crear el certificado, él solo).

Con TizenBrew en la tele, FreeTV:

- **Pone en el estante YouTube AdFree** ([TizenTube](https://github.com/reisxd/TizenTube): YouTube sin anuncios ni patrocinios, que
  TizenBrew ya trae) en el sitio del YouTube oficial (que sigue en *Todas las apps*), y **Twitch AdFree**
  ([Twizen](https://www.npmjs.com/package/@jjg0/twizen): Twitch sin anuncios). Si ya tenías el estante a tu gusto, se añaden una vez.
- La primera vez que abres **Twitch AdFree**, FreeTV pregunta y lo añade a TizenBrew (es código de otra persona), y lo abre.
- El icono **Tienda** (y *Ajustes de inicio → Apps de la comunidad*) muestra los módulos: los recomendados, **Buscar más…** (en npm, los
  publicados para TizenBrew) y **Añadir por nombre…** (`npm/<paquete>` o `gh/<usuario>/<repositorio>`, de GitHub). Desde ahí se abren,
  se añaden o se quitan. Siempre pregunta antes de añadir.

Cómo lo hace (`home/tizenbrew.js`): abre un módulo pidiéndoselo a TizenBrew (`launchAppControl` con `{moduleName, moduleType}`, lo que
TizenBrew lee al arrancar), y para ver, añadir o quitar módulos habla con el servicio de TizenBrew (`ws://127.0.0.1:8081`). Ese servicio
solo está en marcha si TizenBrew se ha abierto desde que se encendió la tele: si no, FreeTV lo dice y ofrece abrirlo. Si TizenBrew ya
está abierto en segundo plano, puede que al pedirle un módulo solo se ponga delante en vez de abrirlo. **Probado en un navegador con una
Samsung y un TizenBrew simulados, no en una Samsung.**

Sin TizenBrew, la Tienda explica cómo instalarlo y el estante es el de siempre.

## Créditos

El empaquetado, el instalador por SDB (`tizen/install.py`) y los logos de Samsung vienen de
[Free My TV](https://freemytv.io) (MIT). Detalles en [NOTICE.md](../NOTICE.md).
