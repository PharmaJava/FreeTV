#!/usr/bin/env python3
"""FreeTV's Store on LG: the most starred webOS apps on GitHub, as a catalogue the TV reads (webos/catalog.json).

Once a day (.github/workflows/webos-catalog.yml) GitHub is searched for webOS projects, the most starred first. For each one its
newest release that carries an .ipk is downloaded once here: the package itself says the app's id, version, name and icon
(control and appinfo.json inside it), and its SHA-256 is pinned. The TV installs only that exact file, checked against that hash, and
always after the person's "unofficial" yes (store-service/store.js, home/home.js). Left out: what the webOS Homebrew catalogue already
offers (it stays the source for those), our own apps, anything that says it needs root, forks, archived projects and packages over
150 MB. A project that cannot be checked this time keeps its previous entry.

    python3 tools/webos_catalog.py            # GITHUB_TOKEN for the API when set
    python3 tools/webos_catalog.py --check    # exit 1 when the catalogue would change (nothing written)
"""
import hashlib
import io
import json
import os
import re
import sys
import tarfile
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG = os.path.join(ROOT, 'webos', 'catalog.json')
ICONS = os.path.join(ROOT, 'webos', 'catalog-icons')
ICON_URL = 'https://raw.githubusercontent.com/PharmaJava/FreeTV/main/webos/catalog-icons/'
HOMEBREW = 'https://repo.webosbrew.org/api/apps.json'
MAX_IPK = 150 * 1024 * 1024
MAX_ICON = 300 * 1024
MAX_APPS = 40
MIN_STARS = 15
QUERIES = ['topic:webos', 'topic:webos-app', 'topic:webos-homebrew', 'topic:lg-webos', 'topic:webostv', 'webos ipk in:name,description']
# our own apps, and the other home screens FreeTV comes from (Free My TV and its copies): not offered beside FreeTV
OWN = {'tv.stremioorigin.app', 'com.gathin.tvhome', 'com.local.nativehome', 'com.gathin.tvhome.store', 'io.freemytv', 'org.webos.freemytv'}
# needing root, as a project says it ("no root needed" is the opposite: that is fine)
ROOT_YES = re.compile(r'autoroot|jailbreak|rootmytv|crashd|getroot|dejavuln|faultmanager|\brooted\b|root[- ]access|root[- ]only'
                      r'|\b(requires?|needs?|needed|requiring)\b[^.]{0,25}\broot\b|\broot\b[^.]{0,15}\b(required|needed)\b|^root$|^rooting$', re.I)
ROOT_NO = re.compile(r"\b(no|without|doesn.t need|does not need|not require|no need for)\b[^.]{0,15}\broot", re.I)
ID_RE = re.compile(r'^[A-Za-z0-9._-]{1,80}$')


def get(url, accept='application/vnd.github+json', limit=MAX_IPK + 1):
    req = urllib.request.Request(url, headers={'User-Agent': 'FreeTV-catalog', 'Accept': accept})
    if os.environ.get('GITHUB_TOKEN') and url.startswith('https://api.github.com/'):
        req.add_header('Authorization', 'Bearer ' + os.environ['GITHUB_TOKEN'])
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read(limit)


def api(path):
    return json.loads(get('https://api.github.com' + path))


def candidates():
    """Unique repositories from every query, most starred first."""
    seen = {}
    for q in QUERIES:
        for page in (1, 2):
            try:
                res = api('/search/repositories?q=' + urllib.parse.quote(q + ' stars:>=%d' % MIN_STARS) + '&sort=stars&order=desc&per_page=50&page=%d' % page)
            except Exception as e:  # a query that fails only gives fewer candidates
                print('search %r: %s' % (q, e), file=sys.stderr)
                break
            for r in res.get('items', []):
                if r.get('fork') or r.get('archived'):
                    continue
                seen[r['full_name']] = r
            if len(res.get('items', [])) < 50:
                break
    return sorted(seen.values(), key=lambda r: -r.get('stargazers_count', 0))


def ar_members(data):
    """The members of an ar archive (an .ipk): {name: bytes}."""
    if data[:8] != b'!<arch>\n':
        raise ValueError('not an ipk (ar) archive')
    out, i = {}, 8
    while i + 60 <= len(data):
        h = data[i:i + 60]
        name = h[:16].decode('ascii', 'replace').strip().rstrip('/')
        size = int(h[48:58].decode('ascii').strip())
        out[name] = data[i + 60:i + 60 + size]
        i += 60 + size + (size & 1)
    return out


def tar_of(blob):
    return tarfile.open(fileobj=io.BytesIO(blob), mode='r:*')


def read_ipk(data):
    """(id, version, title, icon bytes or None, needs root?) from the package itself."""
    m = ar_members(data)
    ctl = next((v for k, v in m.items() if k.startswith('control.tar')), None)
    dat = next((v for k, v in m.items() if k.startswith('data.tar')), None)
    if not ctl or not dat:
        raise ValueError('no control or data in the package')
    pkg = ver = ''
    with tar_of(ctl) as t:
        for mem in t.getmembers():
            if mem.name.lstrip('./') == 'control':
                for line in t.extractfile(mem).read().decode('utf-8', 'replace').splitlines():
                    if line.startswith('Package:'):
                        pkg = line.split(':', 1)[1].strip()
                    elif line.startswith('Version:'):
                        ver = line.split(':', 1)[1].strip()
    info, icon, root = None, None, False
    with tar_of(dat) as t:
        names = {mem.name.lstrip('./'): mem for mem in t.getmembers() if mem.isfile()}
        base = 'usr/palm/applications/%s/' % pkg
        if base + 'appinfo.json' in names:
            info = json.loads(t.extractfile(names[base + 'appinfo.json']).read().decode('utf-8', 'replace'))
            ic = info.get('icon') or info.get('largeIcon')
            if isinstance(ic, str) and base + ic.lstrip('./') in names and names[base + ic.lstrip('./')].size <= MAX_ICON:
                icon = t.extractfile(names[base + ic.lstrip('./')]).read()
        # a service or file that only works as root: a jailbreak's own package (the Developer Mode jail would refuse it)
        root = any(n.startswith(('etc/', 'var/', 'usr/sbin/', 'lib/')) for n in names) or bool(info and info.get('requiredPermissions') and 'root' in json.dumps(info))
    if not info:
        raise ValueError('no appinfo.json for %s' % pkg)
    return pkg, ver or str(info.get('version', '')), str(info.get('title') or pkg), icon, root


def entry(repo, homebrew_ids):
    full = repo['full_name']
    text = ' '.join([repo.get('name', ''), repo.get('description') or '']); topics = repo.get('topics', [])
    if any(ROOT_YES.search(t) for t in topics) or (ROOT_YES.search(text) and not ROOT_NO.search(text)):
        raise ValueError('says it needs root')
    rels = api('/repos/%s/releases?per_page=10' % full)
    rel = next((r for r in rels if not r.get('draft') and not r.get('prerelease') and any(a['name'].lower().endswith('.ipk') for a in r.get('assets', []))), None)
    if not rel:
        raise ValueError('no release with an .ipk')
    ipks = [a for a in rel['assets'] if a['name'].lower().endswith('.ipk') and a['browser_download_url'].startswith('https://github.com/')]
    ipk = next((a for a in ipks if re.search(r'_all\.ipk$', a['name'], re.I)), None) or next((a for a in ipks if re.search(r'_(arm|armv7)\.ipk$', a['name'], re.I)), None) or (ipks[0] if ipks else None)
    if not ipk or ipk.get('size', 0) > MAX_IPK:
        raise ValueError('no usable .ipk (or too big)')
    data = get(ipk['browser_download_url'], accept='application/octet-stream')
    if len(data) > MAX_IPK:
        raise ValueError('too big')
    pkg, ver, title, icon, root = read_ipk(data)
    if not ID_RE.match(pkg) or pkg in OWN:
        raise ValueError('id %r not offered' % pkg)
    if pkg in homebrew_ids:
        raise ValueError('already in webOS Homebrew')
    if root or re.search(r'root|exploit|jailbreak', pkg, re.I):
        raise ValueError('installs system files or says root in its id (needs root)')
    if title.strip().lower() in ('home', 'launcher', 'app', 'player', 'tv', 'webos') or len(title.strip()) < 3:
        title = re.sub(r'[-_]+', ' ', repo['name']).strip().title()
    sha = hashlib.sha256(data).hexdigest()
    icon_uri = ''
    if icon and (icon[:8] == b'\x89PNG\r\n\x1a\n'):
        os.makedirs(ICONS, exist_ok=True)
        with open(os.path.join(ICONS, pkg + '.png'), 'wb') as f:
            f.write(icon)
        icon_uri = ICON_URL + pkg + '.png'
    desc = (repo.get('description') or '').strip()
    return {'id': pkg, 'title': title, 'iconUri': icon_uri, 'shortDescription': desc[:140], 'github': True,
            'repo': 'github.com/' + full, 'stars': repo.get('stargazers_count', 0),
            'manifest': {'id': pkg, 'version': ver, 'title': title, 'rootRequired': False, 'ipkUrl': ipk['browser_download_url'],
                         'ipkSize': len(data), 'ipkHash': {'sha256': sha}, 'sourceUrl': 'https://github.com/' + full, 'appDescription': desc}}


def main():
    check = '--check' in sys.argv
    old = {}
    try:
        with open(CATALOG, encoding='utf-8') as f:
            old = {p['repo']: p for p in json.load(f).get('packages', [])}
    except (OSError, ValueError):
        pass
    try:
        homebrew_ids = {p.get('id') for p in json.loads(get(HOMEBREW, accept='application/json')).get('packages', [])}
    except Exception as e:
        print('webOS Homebrew catalogue: %s (nothing left out for it this time)' % e, file=sys.stderr)
        homebrew_ids = set()
    out, ids, report = [], set(), []
    for repo in candidates():
        if len(out) >= MAX_APPS:
            break
        key = 'github.com/' + repo['full_name']
        try:
            p = entry(repo, homebrew_ids)
        except Exception as e:
            p = old.get(key)
            if p and 'already in webOS Homebrew' not in str(e) and 'needs root' not in str(e) and 'not offered' not in str(e):
                report.append('| %s | kept the previous entry (%s) |' % (repo['full_name'], e))
            else:
                if not str(e).startswith('no release'):
                    report.append('| %s | left out: %s |' % (repo['full_name'], e))
                continue
        if p['id'] in ids:
            continue
        ids.add(p['id'])
        out.append(p)
        report.append('| %s | %s %s · %d stars |' % (repo['full_name'], p['id'], p['manifest']['version'], p['stars']))
    out.sort(key=lambda p: -p.get('stars', 0))
    text = json.dumps({'source': 'GitHub, the most starred webOS apps (tools/webos_catalog.py)', 'packages': out}, indent=1, ensure_ascii=False) + '\n'
    print('| project | in the catalogue |\n|---|---|\n' + '\n'.join(report))
    print('\n%d apps' % len(out))
    cur = ''
    try:
        with open(CATALOG, encoding='utf-8') as f:
            cur = f.read()
    except OSError:
        pass
    if check:
        sys.exit(1 if cur != text else 0)
    os.makedirs(os.path.dirname(CATALOG), exist_ok=True)
    with open(CATALOG, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


if __name__ == '__main__':
    main()
