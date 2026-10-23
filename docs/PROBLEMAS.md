# Problemas y soluciones

## En la tele

**No puedo iniciar sesión en la app Developer Mode.** La app pide correo y contraseña de LG. Si creaste la cuenta con
«Iniciar sesión con Apple/Google», no tiene contraseña: en webostv.developer.lge.com usa *Forgot password* con ese correo
para ponerle una. Comprueba también que verificaste el correo (LG manda un enlace).

**El ayudante pide la passphrase y no sé cuál es.** Abre la app *Developer Mode* en la tele, con el **Key Server** en ON: la
passphrase (seis caracteres) está en pantalla. Cambia cuando reinicias el Key Server o la tele.

**Pulso Home y me lleva al inicio de LG, no a FreeTV.** El ayudante del botón Home no está funcionando. Lo más
habitual en teles con webOS algo antiguo es que **no arranque** porque el Node de la tele es viejo; FreeTV ya lo arregla, pero
si instalaste otra versión del ayudante, vuelve a ejecutar `bash install.sh <IP>`. Si lo pulsaste 2 segundos, está parado
a propósito: abre *Ajustes de inicio → Reactivar el botón Home* (o abre la app **Home Helper** de la lista de apps de LG).

**Con Atrás veo el inicio de LG un momento.** Es normal: al salir de una app, LG pone su inicio y el ayudante espera algo
más de un segundo a que se asiente antes de abrir FreeTV (si abre antes, LG lo tapa y se ve ir y venir). Si ves varios
cambios seguidos o no recupera nunca la pantalla, mira el registro (abajo): debe salir un solo `return-after-exit` y un
`launch`. Puedes cambiar la espera en `tools/patch_helper.py` (`RETURN_DELAY`) y volver a instalar. Abre una *Issue* si no
mejora.

**Al encender la tele sale el inicio de LG.** El ayudante lo abre pocos segundos después de encender. Algunas teles no
dejan abrirlo a tiempo; si pasa siempre, pulsa **Home** una vez. En *Ajustes de la tele* busca *Iniciar con la última app* /
*Auto launch* si tu modelo la tiene (cambia según el modelo).

**Desapareció FreeTV de la tele.** El Modo Desarrollador caducó (a los ~40 días) y la tele borra las apps de desarrollador.
Vuelve a activar el *Dev Mode Status* y ejecuta otra vez `bash install.sh <IP>`.

**No se ven mis apps / faltan iconos.** La lista de apps se lee al instalar. Si instalas o quitas apps, vuelve a ejecutar
`bash install.sh <IP>`.

**No salen recomendaciones.** Falta la clave de TMDB en `config.properties` (`tmdb_key=`), o los servicios están apagados en
*Ajustes de inicio → Sugerencias*. Con la clave puesta, tarda uno o dos minutos la primera vez.

**Las cotizaciones salen con «—».** Hay que tener internet. Los precios vienen de Binance (cripto) y de Yahoo Finance
(S&P 500 y NASDAQ 100); si Yahoo no responde, se usa justETF. Si fallan los dos, se muestra el último precio guardado.

**Una app de la comunidad dice «no available space».** La tele tiene poco espacio para apps. Borra en la tele las que no uses
(mantén OK sobre ellas en el inicio de LG): desde el ordenador no se puede. Mira [COMUNIDAD.md](COMUNIDAD.md).

**YouTube sin anuncios: «Success» pero no se instala, y desaparece el acceso de YouTube del inicio de LG.** Instalaste con el YouTube
oficial puesto. Reinicia la tele (el acceso suele volver), **bórralo tú en la tele** y vuelve a instalar con `--official-removed`.

## En el ordenador

**`./install.sh` dice que falta `node`, `python3` o `git`.** Instálalos como en el [README](../README.md). El instalador
pide Node 20 o más y Python 3.9 o más.

**Error `python3 -m venv` / `ensurepip`.** En Ubuntu/WSL: `sudo apt install -y python3-venv`.

**El instalador se queda esperando o no conecta con la tele.** Comprueba que el ordenador y la tele están en la **misma
red**, que la app *Developer Mode* está abierta con **Key Server ON**, y que la IP es la correcta. En Windows, ejecuta
todo **dentro de Ubuntu (WSL)**, en tu carpeta personal, no en `/mnt/c`.

**`bash\r: No such file or directory`.** Se copiaron los archivos con finales de línea de Windows. Clona el repositorio **dentro
de Ubuntu**, no lo copies desde Windows. Para arreglarlo en el sitio: `sed -i 's/\r$//' install.sh tools/*.py`.

**`this helper version is not the one FreeTV was made for`.** El ayudante descargado no es la versión que usa FreeTV.
Borra la carpeta `work/` y vuelve a ejecutar `bash install.sh <IP>` (descarga la versión exacta).

## Mirar qué hace el ayudante (para pedir ayuda)

Con la tele encendida, desde `FreeTV/work/helper`:

```bash
export PATH="$PWD/build/tools/node_modules/.bin:$PATH"
ares-novacom -d clean-your-tv-192-168-1-140 --run "tail -n 40 /media/developer/apps/usr/palm/applications/com.local.nativehome/state/controller.log"
```

(cambia `192-168-1-140` por tu IP con guiones). Verás líneas como `foreground`, `return-after-exit` o `return-retry`. Si
sale `SyntaxError`, el ayudante no arranca en tu tele: abre una *Issue* con esas líneas. **Antes de pegarlas, comprueba
que no llevan datos tuyos.**

## Quitarlo todo

Mira «Desinstalar» en el [README](../README.md). Si algo no te deja ni eso, **mantén Home 2 segundos** y, en la tele,
borra las apps *FreeTV* y *Home Helper* desde la lista de apps (mantén OK sobre ellas).
