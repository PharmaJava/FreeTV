#!/usr/bin/env python3
"""FreeTV's Store for Android TV: android/catalog-sources.json → android/catalog.json.

For each app: its newest GitHub release (optionally only tags matching "tag"), the APK asset matching "asset" (the first of
"prefer" found in its name, else the first match), downloaded once here: aapt2 must read the package name the source says
(a different app under that name is refused) and its version, and its SHA-256 is pinned in the catalog. The TV then only installs
that exact file (android/app/src/io/freemytv/WebHome.java). An app that cannot be checked keeps its previous entry.

    python3 tools/android_catalog.py            # GITHUB_TOKEN for the API when set; AAPT2 or ANDROID_HOME for aapt2
    python3 tools/android_catalog.py --check    # exit 1 when the catalog would change (nothing written)
"""
import glob
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(ROOT, 'android', 'catalog-sources.json')
CATALOG = os.path.join(ROOT, 'android', 'catalog.json')
MAX_APK = 150 * 1024 * 1024


def get(url, accept='*/*'):
    req = urllib.request.Request(url, headers={'User-Agent': 'FreeTV-catalog', 'Accept': accept})
    if os.environ.get('GITHUB_TOKEN') and url.startswith('https://api.github.com/'):
        req.add_header('Authorization', 'Bearer ' + os.environ['GITHUB_TOKEN'])
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read(MAX_APK + 1)


def aapt2():
    if os.environ.get('AAPT2'):
        return os.environ['AAPT2']
    sdk = os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT') or ''
    found = sorted(glob.glob(os.path.join(sdk, 'build-tools', '*', 'aapt2')))
    return found[-1] if found else 'aapt2'


def badging(path):
    """(package, versionName, versionCode, minSdk) of an APK, read by aapt2."""
    out = subprocess.run([aapt2(), 'dump', 'badging', path], capture_output=True, text=True, timeout=120).stdout
    m = re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']*)'", out)
    sdk = re.search(r"sdkVersion:'(\d+)'", out) or re.search(r"minSdkVersion:'(\d+)'", out)
    if not m:
        raise ValueError('aapt2 could not read the package')
    return m.group(1), m.group(3), int(m.group(2)), int(sdk.group(1)) if sdk else 0


def pick_asset(assets, src):
    rx = re.compile(src['asset'])
    found = [a for a in assets if rx.search(a['name']) and a['name'].lower().endswith('.apk')]
    for want in src.get('prefer', []):
        for a in found:
            if want.lower() in a['name'].lower():
                return a
    return found[0] if found else None


def entry_for(src, releases, fetch=get, read=badging):
    tag = re.compile(src.get('tag', '.'))
    prefix = 'https://github.com/%s/releases/download/' % src['repo']
    for rel in releases:
        if rel.get('draft') or rel.get('prerelease') or not tag.search(rel.get('tag_name', '')):
            continue
        asset = pick_asset([a for a in rel.get('assets', []) if a.get('browser_download_url', '').startswith(prefix)], src)
        if not asset:
            continue
        data = fetch(asset['browser_download_url'])
        if len(data) > MAX_APK:
            raise ValueError('APK too big')
        with tempfile.NamedTemporaryFile(suffix='.apk', delete=False) as f:
            f.write(data)
        try:
            pkg, version, code, min_sdk = read(f.name)
        finally:
            os.unlink(f.name)
        if pkg != src['id']:
            raise ValueError('%s is %s, not %s' % (asset['name'], pkg, src['id']))
        return {'id': src['id'], 'title': src['title'], 'desc': src['desc'], 'repo': src['repo'], 'tag': rel['tag_name'],
                'version': version, 'versionCode': code, 'minSdk': min_sdk, 'url': asset['browser_download_url'],
                'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    raise ValueError('no release with a matching APK')


def build(fetch=get, read=badging, log=print):
    sources = json.load(open(SOURCES, encoding='utf-8'))['apps']
    try:
        old = {a['id']: a for a in json.load(open(CATALOG, encoding='utf-8')).get('apps', [])}
    except (OSError, ValueError):
        old = {}
    apps = []
    for src in sources:
        try:
            releases = json.loads(fetch('https://api.github.com/repos/%s/releases?per_page=20' % src['repo']).decode('utf-8'))
            prev = old.get(src['id'])
            e = entry_for(src, releases, fetch, read)
            if prev and prev.get('url') == e['url'] and prev.get('sha256') != e['sha256']:
                raise ValueError('the same file now has another SHA-256: kept the pinned one')
            apps.append(e)
            log('ok   %-32s %s (%s)' % (src['id'], e['version'], e['tag']))
        except Exception as ex:   # one app's trouble never takes the others down
            log('skip %-32s %s' % (src['id'], ex))
            if src['id'] in old:
                apps.append(old[src['id']])
    return {'about': "FreeTV's Store on Android TV. Made by tools/android_catalog.py from catalog-sources.json: do not edit by hand.",
            'apps': apps}


def main(argv):
    cat = build()
    text = json.dumps(cat, ensure_ascii=False, indent=1, sort_keys=True) + '\n'
    try:
        same = open(CATALOG, encoding='utf-8').read() == text
    except OSError:
        same = False
    if '--check' in argv:
        sys.exit(0 if same else 1)
    if not same:
        open(CATALOG, 'w', encoding='utf-8').write(text)
        print('catalog.json updated (%d apps)' % len(cat['apps']))
    else:
        print('catalog.json unchanged')


if __name__ == '__main__':
    main(sys.argv[1:])
