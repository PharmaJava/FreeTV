#!/usr/bin/env python3
"""Community apps for LG webOS, from the webOS Homebrew catalogue (https://repo.webosbrew.org), installed the safe way.

    python3 tools/community.py list [--all]             # apps you can install without root (--all: also the ones that need root)
    python3 tools/community.py info <id>                # what it is, its version, where its code is, what it asks of your TV
    python3 tools/community.py install <id> <TV IP>     # download, CHECK THE HASH, ask you, install
    python3 tools/community.py remove <id> <TV IP>      # uninstall
    python3 tools/community.py fetch <id>               # only download and verify, touch nothing
    python3 tools/community.py serve <TV IP>            # let the TV's "Community apps" screen install apps through this computer

What it will and won't do:
  * It installs only apps the catalogue says do NOT need root, with the normal Developer Mode (the same way FreeTV is
    installed). It never roots a TV and never runs anything on the TV as root.
  * It refuses a package whose SHA-256 hash is missing or does not match the one in the catalogue.
  * It always shows what it is about to install, and asks. Use --yes to skip the question (for scripts).
  * Apps that replace one of LG's own apps (YouTube AdFree) or open sensitive menus need an extra, explicit flag.
  * `serve` is the same installer, started from the TV: the TV asks the person (OK on a confirmation screen), and this
    computer downloads, checks the hash and installs. It answers only the TV's own address, only for catalogue apps.
The catalogue and the apps are made by other people: read an app's page before installing it. FreeTV only passes on what
the catalogue publishes.
"""
import hashlib
import http.server
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOGUE = 'https://repo.webosbrew.org/api/apps.json'
WORK = os.path.join(ROOT, 'work', 'community')
HOME_APP = 'com.gathin.tvhome'
PORT = 8777

# Said before installing, with a flag that must be given on purpose.
CAUTION = {
    'youtube.leanback.v4': ('official-removed', 'Reemplaza la app oficial de YouTube (tiene su mismo identificador). LG NO deja quitar la oficial '
                            'desde el ordenador: tienes que borrarla TÚ en la tele ANTES (inicio de LG, mantén OK sobre YouTube y elige '
                            'Eliminar; se puede volver a poner desde la LG Content Store). Si se instala con la oficial puesta, la tele dice '
                            '«Success» pero deja a la oficial sin su acceso directo y la versión nueva no se instala (nos pasó). '
                            'Cuando la hayas borrado, añade --official-removed. Quita anuncios, y eso puede ir contra las condiciones '
                            'de uso de YouTube: es tu decisión.'),
    'com.open.hidden.menu': ('sensitive', 'Abre el menú de servicio oculto de LG. Cambiar ahí ajustes puede estropear la tele y anular la '
                             'garantía. Instálala solo si sabes exactamente qué vas a tocar.'),
    'com.pirate.refresh': ('sensitive', 'Renueva el Modo Desarrollador por su cuenta, sin pasar por LG. FreeTV ya trae un panel de renovación (beta): '
                           'no hace falta usar las dos.'),
    'org.webosbrew.hbchannel': ('sensitive', 'La tienda Homebrew Channel solo es útil entera en una tele con ROOT, que FreeTV no hace ni '
                                'recomienda. Sin root casi todo lo que hace no funciona.'),
}


def say(text=''):
    print(text, flush=True)


PROGRESS = None   # `serve` sets this to follow a job: PROGRESS(phase, message)


def progress(phase, message=''):
    if PROGRESS:
        PROGRESS(phase, message)


def fetch_json(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'FreeTV-community/1.0'})
    with urllib.request.urlopen(request, timeout=30) as r:
        return json.load(r)


def catalogue():
    return fetch_json(CATALOGUE)['packages']


def find(apps, app_id):
    for a in apps:
        if a['id'] == app_id:
            return a
    sys.exit('No hay ninguna app con el id «%s» en el catálogo. Mira `python3 tools/community.py list`.' % app_id)


def requirements(a):
    parts = []
    r = a.get('requirements') or {}
    if r.get('webosRelease'):
        parts.append('webOS %s' % r['webosRelease'])
    if r.get('deviceSoC'):
        parts.append('chip: %s' % ', '.join(r['deviceSoC']))
    return ', '.join(parts) or 'sin requisitos indicados'


def cmd_list(show_all):
    apps = catalogue()
    rows = sorted(apps, key=lambda a: (bool(a['manifest'].get('rootRequired')), a['title'].lower()))
    say('%-4s %-42s %-12s %s' % ('', 'id', 'versión', 'nombre'))
    for a in rows:
        m = a['manifest']
        if m.get('rootRequired') and not show_all:
            continue
        flag = 'ROOT' if m.get('rootRequired') else ('!' if a['id'] in CAUTION else '')
        say('%-4s %-42s %-12s %s' % (flag, a['id'][:42], str(m.get('version', ''))[:12], a['title']))
    say()
    say('! = pide un aviso extra al instalar · ROOT = necesita una tele rooteada: FreeTV no la instala.')
    say('Más detalles: python3 tools/community.py info <id>')


def describe(a):
    m = a['manifest']
    say('%s  (%s)  v%s' % (a['title'], a['id'], m.get('version')))
    say('  %s' % (a.get('shortDescription') or m.get('appDescription') or ''))
    say('  Necesita: %s' % requirements(a))
    say('  Root: %s' % ('SÍ — FreeTV no lo instala' if m.get('rootRequired') else 'no'))
    say('  Código: %s' % m.get('sourceUrl', '(no indicado)'))
    say('  Paquete: %s' % m.get('ipkUrl', '(no indicado)'))
    if m.get('ipkHash', {}).get('sha256'):
        say('  SHA-256: %s' % m['ipkHash']['sha256'])
    if a['id'] in CAUTION:
        say('  OJO: %s' % CAUTION[a['id']][1])


def download(a):
    m = a['manifest']
    url, want = m.get('ipkUrl', ''), (m.get('ipkHash') or {}).get('sha256', '')
    if not url.startswith('https://'):
        sys.exit('El paquete no está en una dirección https: no lo descargo.')
    if not want:
        sys.exit('El catálogo no publica el hash SHA-256 de este paquete: no lo instalo sin poder comprobarlo.')
    os.makedirs(WORK, exist_ok=True)
    path = os.path.join(WORK, '%s_%s.ipk' % (a['id'], m.get('version', 'x')))
    say('Descargando %s …' % url)
    progress('downloading')
    request = urllib.request.Request(url, headers={'User-Agent': 'FreeTV-community/1.0'})
    sha = hashlib.sha256()
    with urllib.request.urlopen(request, timeout=120) as r, open(path, 'wb') as out:
        while True:
            chunk = r.read(1 << 16)
            if not chunk:
                break
            sha.update(chunk)
            out.write(chunk)
    progress('verifying')
    if sha.hexdigest().lower() != want.lower():
        os.remove(path)
        sys.exit('El hash NO coincide (esperado %s, obtenido %s). Lo he borrado y no lo instalo.' % (want, sha.hexdigest()))
    say('Hash SHA-256 correcto (%s…).' % want[:16])
    return path


def ares(tool, required=True):
    local = os.path.join(ROOT, 'work', 'helper', 'build', 'tools', 'node_modules', '.bin', tool + ('.cmd' if os.name == 'nt' else ''))
    found = local if os.path.exists(local) else shutil.which(tool)
    if not found and not required:
        return tool
    if not found:
        sys.exit('No encuentro «%s». Instala FreeTV primero (bash install.sh <IP>): deja las herramientas de LG en work/helper.' % tool)
    return found


def device(ip):
    return 'clean-your-tv-' + ip.replace('.', '-')


def free_space_mb(ip):
    """Free megabytes on the TV's apps partition, or None when it can't be read (best effort)."""
    try:
        out = subprocess.run([ares('ares-novacom', False), '-d', device(ip), '--run',
                              'df -m /media/developer | tail -1'], capture_output=True, text=True, timeout=60).stdout
        return int(out.split()[3])
    except Exception:
        return None


def check_installable(a, flags):
    """Stops (SystemExit with the reason) unless this app may be installed: no root, and its extra flag given on purpose."""
    if a['manifest'].get('rootRequired'):
        sys.exit('Esta app necesita una tele con root. FreeTV no hace root ni instala apps que lo necesiten.')
    caution = CAUTION.get(a['id'])
    if caution and ('--%s' % caution[0]) not in flags:
        sys.exit('Esta app necesita un aviso extra. Léelo arriba y, si de verdad quieres seguir, añade --%s al comando.' % caution[0])


def space_note(a, path, ip):
    """Says how much room the package needs and the TV has; returns a warning when it may not fit (else '')."""
    size_mb = (a['manifest'].get('ipkSize') or os.path.getsize(path)) / 1048576.0
    free = free_space_mb(ip)
    if free is None:
        return ''
    say('Ocupa unos %.0f MB en el paquete y la tele tiene %d MB libres para apps.' % (size_mb, free))
    if free < size_mb * 2.2:
        note = ('AVISO: descomprimida ocupa bastante más que el paquete; quizá no quepa. Si falla con «no available space», '
                'libera espacio borrando apps que no uses EN LA TELE (desde el ordenador no se pueden quitar las de LG).')
        say(note)
        return note
    return ''


def install_package(app_id, path, ip, capture=False):
    """ares-install; returns (exit code, the tool's last words). Then checks the app really is there: the TV has said
    «Success» for an install that did not happen (YouTube AdFree over the official one)."""
    if capture:
        r = subprocess.run([ares('ares-install'), '-d', device(ip), path], capture_output=True, text=True, timeout=600)
        text = ((r.stdout or '') + '\n' + (r.stderr or '')).strip()
        code = r.returncode
    else:
        code, text = subprocess.run([ares('ares-install'), '-d', device(ip), path]).returncode, ''
    if code == 0:
        text = ''   # «Success» is not news; what is left, if anything, is a warning
        try:
            listed = subprocess.run([ares('ares-install'), '-d', device(ip), '--list'], capture_output=True, text=True, timeout=60).stdout
            if listed.strip() and app_id not in listed:
                text = ('La tele dijo que sí, pero «%s» no aparece entre sus apps. Si es la que sustituye a una de LG, '
                        'borra la original en la tele y vuelve a probar.' % app_id)
                say(text)
        except Exception:
            pass
    return code, text


def cmd_install(app_id, ip, args):
    a = find(catalogue(), app_id)
    describe(a)
    say()
    check_installable(a, args)
    path = download(a)
    space_note(a, path, ip)
    if '--yes' not in args:
        if not sys.stdin.isatty():
            sys.exit('Sin terminal para preguntarte: añade --yes si quieres instalarla de todos modos.')
        if input('¿Instalar «%s» en la tele %s? [s/N] ' % (a['title'], ip)).strip().lower() not in ('s', 'si', 'sí', 'y', 'yes'):
            sys.exit('No se instala nada.')
    if '--dry-run' in args:
        say('(--dry-run) Aquí instalaría: %s -d %s %s' % (ares('ares-install', False), device(ip), path))
        return
    sys.exit(install_package(app_id, path, ip)[0])


def cmd_remove(app_id, ip, args):
    if '--yes' not in args and sys.stdin.isatty():
        if input('¿Quitar «%s» de la tele %s? [s/N] ' % (app_id, ip)).strip().lower() not in ('s', 'si', 'sí', 'y', 'yes'):
            sys.exit('No se quita nada.')
    sys.exit(subprocess.run([ares('ares-install'), '-d', device(ip), '-r', app_id]).returncode)


# MARK: - serve: the TV's "Community apps" screen installs through this computer

IPV4 = re.compile(r'^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$')
JOB = {'phase': 'idle', 'id': '', 'title': '', 'message': '', 'note': '', 'at': 0}
JOB_LOCK = threading.Lock()


def set_job(**fields):
    with JOB_LOCK:
        JOB.update(fields)
        JOB['at'] = time.time()


def tidy(text, limit=400):
    """The tail of a tool's output, short enough for the TV's screen."""
    lines = [l.strip() for l in str(text).splitlines() if l.strip()]
    return ' '.join(lines)[-limit:]


def run_job(app_id, ip, flags):
    """Runs in a thread: the same checks as `install`, then the install; the TV polls /status."""
    global PROGRESS
    PROGRESS = lambda phase, message='': set_job(phase=phase, message=message)
    try:
        a = find(catalogue(), app_id)
        set_job(title=a['title'])
        check_installable(a, flags)
        path = download(a)
        set_job(note=space_note(a, path, ip))
        set_job(phase='installing')
        say('Instalando «%s» en la tele …' % a['title'])
        code, text = install_package(app_id, path, ip, capture=True)
        if code == 0 and not text:
            set_job(phase='done', message='')
        elif code == 0:
            set_job(phase='failed', message=tidy(text))
        else:
            set_job(phase='failed', message=tidy(text) or 'ares-install terminó con el código %d.' % code)
    except SystemExit as e:
        set_job(phase='failed', message=tidy(e.code) if isinstance(e.code, str) else 'No se pudo instalar.')
    except Exception as e:   # a network error, a catalogue that changed shape…
        set_job(phase='failed', message=tidy('%s: %s' % (type(e).__name__, e)))
    finally:
        PROGRESS = None
        say('Resultado: %s %s' % (JOB['phase'], JOB['message']))


def lan_address(ip):
    """This computer's address on the network the TV is on (nothing is sent: UDP connect only picks the route)."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.connect((ip, 9922))
        return s.getsockname()[0]


def make_handler(tv_ip):
    class Handler(http.server.BaseHTTPRequestHandler):
        server_version = 'FreeTV-community'

        def log_message(self, fmt, *args):
            say('  [%s] %s' % (self.client_address[0], fmt % args))

        def reply(self, status, body):
            data = json.dumps(body, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Headers', 'X-FreeTV')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST')
            self.end_headers()
            self.wfile.write(data)

        def allowed(self):
            # Only the TV, and only a request a web page cannot make by itself (the custom header forces a preflight).
            if self.client_address[0] != tv_ip:
                self.reply(403, {'ok': False, 'error': 'Solo atiendo a la tele %s.' % tv_ip})
                return False
            if self.command != 'OPTIONS' and self.headers.get('X-FreeTV') != '1':
                self.reply(403, {'ok': False, 'error': 'Falta la cabecera de FreeTV.'})
                return False
            return True

        def do_OPTIONS(self):
            if self.allowed():
                self.reply(200, {'ok': True})

        def do_GET(self):
            if not self.allowed():
                return
            path = urllib.parse.urlparse(self.path).path
            if path == '/ping':
                self.reply(200, {'ok': True, 'service': 'freetv-community', 'version': 1})
            elif path == '/status':
                with JOB_LOCK:
                    self.reply(200, dict(JOB, ok=True))
            else:
                self.reply(404, {'ok': False, 'error': 'No existe.'})

        def do_POST(self):
            if not self.allowed():
                return
            url = urllib.parse.urlparse(self.path)
            if url.path != '/install':
                self.reply(404, {'ok': False, 'error': 'No existe.'})
                return
            query = urllib.parse.parse_qs(url.query)
            app_id = (query.get('id') or [''])[0]
            flag = (query.get('flag') or [''])[0]
            if not re.match(r'^[A-Za-z0-9._-]{1,80}$', app_id):
                self.reply(400, {'ok': False, 'error': 'Identificador no válido.'})
                return
            with JOB_LOCK:
                if JOB['phase'] in ('downloading', 'verifying', 'installing', 'starting'):
                    self.reply(409, {'ok': False, 'error': 'Ya hay una instalación en marcha.'})
                    return
                JOB.update(phase='starting', id=app_id, title='', message='', note='', at=time.time())
            say('La tele pide instalar %s' % app_id)
            threading.Thread(target=run_job, args=(app_id, tv_ip, ['--' + flag] if flag else []), daemon=True).start()
            self.reply(202, {'ok': True})

    return Handler


def cmd_serve(ip, args):
    if not IPV4.match(ip):
        sys.exit('«%s» no es una dirección IP de tele (por ejemplo 192.168.1.50).' % ip)
    port = PORT
    for i, x in enumerate(args):
        if x == '--port' and i + 1 < len(args) and args[i + 1].isdigit():
            port = int(args[i + 1])
    ares('ares-install')   # stops here, before anything else, if FreeTV's tools are not installed
    try:
        mine = lan_address(ip)
    except OSError as e:
        sys.exit('No consigo saber la dirección de este ordenador en la red de la tele (%s).' % e)
    server = http.server.ThreadingHTTPServer((mine, port), make_handler(ip))
    say('FreeTV · apps de la comunidad desde la tele')
    say('  Este ordenador: http://%s:%d   ·   tele: %s' % (mine, port, ip))
    say('  Solo atiendo a la tele, solo apps del catálogo que no piden root, y compruebo el hash antes de instalar.')
    say('  Cada instalación la confirmas TÚ en la pantalla de la tele. Para parar: Ctrl+C.')
    if '--no-launch' not in args:
        # Open FreeTV's home on the store, telling it where this computer is (so nobody types an address with a remote).
        params = json.dumps({'storeHost': mine, 'storePort': port, 'n': os.urandom(4).hex()})
        try:
            r = subprocess.run([ares('ares-launch', False), '-d', device(ip), HOME_APP, '-p', params], capture_output=True, text=True, timeout=60)
            opened, why = r.returncode == 0, tidy(r.stdout + r.stderr, 120)
        except (OSError, subprocess.TimeoutExpired) as e:
            opened, why = False, str(e)
        if opened:
            say('  He abierto la pantalla «Apps de la comunidad» en la tele.')
        else:
            say('  No pude abrir la tele (%s). Ábrela tú: Ajustes de inicio → Apps de la comunidad. Si no encuentra el ordenador, '
                'pon community_host=%s en config.properties y vuelve a ejecutar install.sh.' % (why, mine))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        say('\nParado.')
    finally:
        server.server_close()


def main(argv):
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    args = [x for x in argv[1:]]
    if not args or args[0] in ('-h', '--help'):
        say(__doc__)
        return
    cmd, rest = args[0], args[1:]
    positional = [x for x in rest if not x.startswith('--')]
    if cmd == 'list':
        cmd_list('--all' in rest)
    elif cmd == 'info' and positional:
        describe(find(catalogue(), positional[0]))
    elif cmd == 'fetch' and positional:
        a = find(catalogue(), positional[0])
        if a['manifest'].get('rootRequired'):
            sys.exit('Necesita root: no la descargo.')
        say('Guardado y verificado en %s' % download(a))
    elif cmd == 'install' and len(positional) == 2:
        cmd_install(positional[0], positional[1], rest)
    elif cmd == 'serve' and len(positional) == 1:
        cmd_serve(positional[0], rest)
    elif cmd == 'remove' and len(positional) == 2:
        cmd_remove(positional[0], positional[1], rest)
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main(sys.argv)
