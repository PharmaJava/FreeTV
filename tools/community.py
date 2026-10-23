#!/usr/bin/env python3
"""Community apps for LG webOS, from the webOS Homebrew catalogue (https://repo.webosbrew.org), installed the safe way.

    python3 tools/community.py list [--all]             # apps you can install without root (--all: also the ones that need root)
    python3 tools/community.py info <id>                # what it is, its version, where its code is, what it asks of your TV
    python3 tools/community.py install <id> <TV IP>     # download, CHECK THE HASH, ask you, install
    python3 tools/community.py remove <id> <TV IP>      # uninstall
    python3 tools/community.py fetch <id>               # only download and verify, touch nothing

What it will and won't do:
  * It installs only apps the catalogue says do NOT need root, with the normal Developer Mode (the same way FreeTV is
    installed). It never roots a TV and never runs anything on the TV as root.
  * It refuses a package whose SHA-256 hash is missing or does not match the one in the catalogue.
  * It always shows what it is about to install, and asks. Use --yes to skip the question (for scripts).
  * Apps that replace one of LG's own apps (YouTube AdFree) or open sensitive menus need an extra, explicit flag.
The catalogue and the apps are made by other people: read an app's page before installing it. FreeTV only passes on what
the catalogue publishes.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOGUE = 'https://repo.webosbrew.org/api/apps.json'
WORK = os.path.join(ROOT, 'work', 'community')

# Said before installing, with a flag that must be given on purpose.
CAUTION = {
    'youtube.leanback.v4': ('replace', 'Reemplaza la app oficial de YouTube (tiene su mismo identificador). Antes hay que desinstalar la oficial en '
                            'la tele (mantén OK sobre ella y elige Eliminar); luego se puede volver a poner desde la LG Content Store. '
                            'Quita anuncios, y eso puede ir contra las condiciones de uso de YouTube: es tu decisión.'),
    'com.open.hidden.menu': ('sensitive', 'Abre el menú de servicio oculto de LG. Cambiar ahí ajustes puede estropear la tele y anular la '
                             'garantía. Instálala solo si sabes exactamente qué vas a tocar.'),
    'com.pirate.refresh': ('sensitive', 'Renueva el Modo Desarrollador por su cuenta, sin pasar por LG. FreeTV ya trae un panel de renovación (beta): '
                           'no hace falta usar las dos.'),
    'org.webosbrew.hbchannel': ('sensitive', 'La tienda Homebrew Channel solo es útil entera en una tele con ROOT, que FreeTV no hace ni '
                                'recomienda. Sin root casi todo lo que hace no funciona.'),
}


def say(text=''):
    print(text, flush=True)


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
    request = urllib.request.Request(url, headers={'User-Agent': 'FreeTV-community/1.0'})
    sha = hashlib.sha256()
    with urllib.request.urlopen(request, timeout=120) as r, open(path, 'wb') as out:
        while True:
            chunk = r.read(1 << 16)
            if not chunk:
                break
            sha.update(chunk)
            out.write(chunk)
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


def cmd_install(app_id, ip, args):
    a = find(catalogue(), app_id)
    m = a['manifest']
    describe(a)
    say()
    if m.get('rootRequired'):
        sys.exit('Esta app necesita una tele con root. FreeTV no hace root ni instala apps que lo necesiten.')
    caution = CAUTION.get(app_id)
    if caution and ('--%s' % caution[0]) not in args:
        sys.exit('Esta app necesita un aviso extra. Léelo arriba y, si de verdad quieres seguir, añade --%s al comando.' % caution[0])
    path = download(a)
    if '--yes' not in args:
        if not sys.stdin.isatty():
            sys.exit('Sin terminal para preguntarte: añade --yes si quieres instalarla de todos modos.')
        if input('¿Instalar «%s» en la tele %s? [s/N] ' % (a['title'], ip)).strip().lower() not in ('s', 'si', 'sí', 'y', 'yes'):
            sys.exit('No se instala nada.')
    if '--dry-run' in args:
        say('(--dry-run) Aquí instalaría: %s -d %s %s' % (ares('ares-install', False), device(ip), path))
        return
    result = subprocess.run([ares('ares-install'), '-d', device(ip), path])
    sys.exit(result.returncode)


def cmd_remove(app_id, ip, args):
    if '--yes' not in args and sys.stdin.isatty():
        if input('¿Quitar «%s» de la tele %s? [s/N] ' % (app_id, ip)).strip().lower() not in ('s', 'si', 'sí', 'y', 'yes'):
            sys.exit('No se quita nada.')
    sys.exit(subprocess.run([ares('ares-install'), '-d', device(ip), '-r', app_id]).returncode)


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
    elif cmd == 'remove' and len(positional) == 2:
        cmd_remove(positional[0], positional[1], rest)
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main(sys.argv)
