# Privacidad: qué hace FreeTV y qué sigue haciendo tu LG

Respuesta corta: **FreeTV no quita los rastreadores de LG. No puede, sin root.** Lo que sí hace es no usar la parte de la tele que
lleva la publicidad (la pantalla de inicio de LG), no mandar nada suyo a nadie, y **decirte la verdad** sobre lo que tu tele sigue
haciendo, para que lo apagues tú en los ajustes de LG. Esto es lo que medimos en una LG OLED (webOS 6, 2021), sin root.

## Lo que encontramos en la tele (solo lectura)

- **El ACR de LG está encendido** (`/tmp/acr.xml`: `ACR_On="true"`, `send_data="true"`, `ACRSolution="ALPHONSO"`, captura de **audio**
  activada, `ACRServiceLaunched="true"`). ACR = reconocimiento automático de contenido: la tele escucha el sonido de lo que ves
  (también de lo que entra por HDMI), saca una huella y la manda a un socio de publicidad. Se llama **Live Plus** en los ajustes de LG.
  FreeTV no lo toca: instalar FreeTV no lo apaga.
- Ahora mismo, en la lista de conexiones de la tele, no hay ninguna abierta con servidores de LG (el ACR manda a ratos). Las que había
  eran de FreeTV (fotos del salvapantallas, YouTube).
- Las apps de sistema de LG (inicio de LG, Content Store, alertas de deportes, galería, Home Connect, LG Channels…) **no se pueden
  desinstalar** sin root; solo se pueden **ocultar** de «Todas las apps» de FreeTV.

## Lo que hace FreeTV

| Qué | Cómo |
|---|---|
| No usa el inicio de LG | Tu pantalla de inicio es la de FreeTV: sin banners de promoción, sin «contenido recomendado» de LG. El inicio de LG sigue instalado y arranca en segundo plano. |
| Oculta el desorden de LG | *Ajustes de inicio → Apps ocultas*. Por defecto salen ocultas las alertas de deportes, la galería de arte, el panel de casa y LG Channels (siguen instaladas); mantén OK sobre cualquier app → *Ocultar de aquí*. |
| Te dice si el ACR está activo | *Ajustes de inicio → Privacidad de LG* lo lee de la tele y te enseña el camino para apagarlo. Necesita la clave de la tienda (la pregunta del final de `install.sh`). |
| No manda tus datos | FreeTV no tiene servidor ni analítica. Sus peticiones son solo a: TMDB (recomendaciones), Open-Meteo (tiempo), Binance y Yahoo Finance (cotizaciones), Wikimedia Commons (fotos del salvapantallas), YouTube (buscar canales y su último vídeo), `repo.webosbrew.org` y GitHub (la tienda), y `developer.lge.com` (renovar el Modo Desarrollador, con tu token, que no sale de la tele). |

## Lo que tienes que apagar tú, en la tele

Los nombres cambian según la versión de webOS; busca el equivalente:

1. **Live Plus** (ACR): *Ajustes → General → Sistema → Ajustes adicionales → Live Plus* → apagado.
2. **Promoción del inicio**: *… Ajustes adicionales → Ajustes de inicio → Promoción del inicio / Recomendaciones* → apagado.
3. **Publicidad**: *… Ajustes adicionales → Publicidad → Limitar seguimiento de anuncios* → activado.
4. **Acuerdos de usuario**: *Ajustes → General → Acuerdos de usuario* (o *Soporte → Privacidad y términos*) → desmarca los opcionales
   (información de visionado, publicidad basada en intereses, información de voz) y activa «No vender mi información personal».
5. Tras una **actualización de firmware**, vuelve a mirarlo: LG a veces lo reactiva. *Privacidad de LG* en FreeTV te lo dice.

## Opcional: bloquear dominios en el router

Puedes bloquear en el router o con un bloqueador de DNS los dominios de telemetría y anuncios que se suelen citar (`lgtvsdp.com`,
`lgsmartad.com`, `lgad.cjpowercast.com`, y los de `lgtvcommon.com`). **Cuidado:** algunos sirven funciones de la tele (tienda de LG,
actualizaciones) y no hemos verificado la lista con tu firmware. **No bloquees `developer.lge.com`**: lo usa el Modo Desarrollador para
renovarse. Si algo deja de funcionar, quita el bloqueo.

Fuentes: guías públicas sobre los ajustes de LG (por ejemplo
[Tom's Guide](https://www.tomsguide.com/tvs/your-tv-is-watching-you-how-to-turn-off-data-collection-on-lg-samsung-roku-and-more) y
[AppleInsider](https://appleinsider.com/inside/mac/tips/how-to-stop-your-lg-or-samsung-smart-tv-from-tracking-you)) y la lectura directa
de la configuración de la tele.

## Si tienes una Samsung

Samsung hace lo mismo con otro nombre: reconoce lo que ves en pantalla («servicios de información de visionado») y lo usa para publicidad. FreeTV tampoco puede apagarlo en Samsung. Los nombres cambian según el año y el modelo; busca el equivalente en *Ajustes → Asistencia → Términos y política de privacidad (o «Opciones de privacidad»)*: apaga los *Servicios de información de visionado* y la *Publicidad basada en intereses*, y activa la opción de limitar el seguimiento de anuncios. No lo hemos comprobado en una Samsung.
