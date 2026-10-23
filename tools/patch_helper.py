#!/usr/bin/env python3
"""Fixes and additions for the Home button helper (Razdva122/clean-your-tv-lg-webos), applied to its folder by install.sh:

    python3 tools/patch_helper.py work/helper

1. ws 7.5.10 instead of ws 8. Some LG TVs run Node 8; ws 8 does not even load there (`catch {` and util.types are
   Node 10), so the helper dies at start and the Home button never works. ws 7.5.10 runs on Node 8 and newer.
2. Come back after Back. When an app exits, LG's home takes the screen; the helper opens FreeTV right away, but on some
   TVs LG's home then appears again a moment later and covers it. The helper now waits a moment (so LG has settled),
   opens FreeTV, and looks again, opening it again (up to five times) if LG's home is the one in front.
3. The store service. FreeTV's "Community apps" screen can install apps from the TV itself, without the computer
   (store-service/). It goes in the same package as FreeTV's home (the helper packs `launcher` and `renewal-service`
   together; the store becomes a third folder in that package), and its `state` folder gets the owner and mode that
   Developer Mode shares with its services (tools/fix_store_package.py).

The script stops with a clear message if the helper's code is not what it expects (a different version).
"""
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

OLD = "launch('com.gathin.tvhome',function(ok){launching=false;if(!ok)log({event:'return-after-exit-failed'});});"
# Wait a moment before returning (RETURN_DELAY ms), so LG's own home has settled, then open FreeTV and keep checking.
RETURN_DELAY = int(os.environ.get('FREETV_RETURN_DELAY', '1200'))
NEW = ("setTimeout(function(){if(lastForeground==='com.gathin.tvhome'){launching=false;return;}"
       "launch('com.gathin.tvhome',function(ok){launching=false;if(!ok)log({event:'return-after-exit-failed'});else ensureHome(5);});},%d);" % RETURN_DELAY)

ENSURE = """
// FreeTV: LG's home can come back a moment after we returned from an app. Look again, and open our home again.
function ensureHome(left){
 setTimeout(function(){
  if(stopping||left<=0)return;
  if(lastForeground==='com.webos.app.home'&&!launching){
   launching=true;log({event:'return-retry',left:left});
   launch('com.gathin.tvhome',function(ok){launching=false;ensureHome(left-1);});
  }else ensureHome(left-1);
 },1000);
}
"""
ANCHOR = "var powerPolicy=require('./power-policy')();"

BUILD_OLD = '"$ARES_PACKAGE" launcher renewal-service -o dist'
BUILD_NEW = ('"$ARES_PACKAGE" launcher renewal-service store-service -o dist\n'
             'python3 scripts/fix-store-package.py "dist/$(python3 -c \'import json; a=json.load(open("launcher/appinfo.json")); '
             'print(a["id"]+"_"+a["version"]+"_all.ipk")\')"')


def patch_native(helper):
    path = os.path.join(helper, 'native', 'app', 'native.js')
    with open(path, encoding='utf-8') as f:
        text = f.read().replace('\r\n', '\n')
    if 'ensureHome' in text:
        print('native.js already patched')
        return
    if OLD not in text or ANCHOR not in text:
        sys.exit('patch_helper.py: this helper version is not the one FreeTV was made for (native.js differs). '
                 'Use the commit pinned in install.sh.')
    text = text.replace(OLD, NEW, 1).replace(ANCHOR, ENSURE + ANCHOR, 1)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print('native.js: wait, return and retry after Back added')


def patch_store(helper):
    source = os.path.join(ROOT, 'store-service')
    if not os.path.isdir(os.path.join(source, 'node_modules', 'ssh2')):
        sys.exit('patch_helper.py: the store service has no node_modules yet: run `npm ci --omit=dev --ignore-scripts` in store-service/.')
    target = os.path.join(helper, 'store-service')
    if os.path.isdir(target):
        shutil.rmtree(target)
    # never carry a key from a development folder into the package
    shutil.copytree(source, target, ignore=shutil.ignore_patterns('key.pem', '.key.tmp', '*.log'))
    shutil.copy(os.path.join(ROOT, 'tools', 'fix_store_package.py'), os.path.join(helper, 'scripts', 'fix-store-package.py'))
    path = os.path.join(helper, 'scripts', 'build.sh')
    with open(path, encoding='utf-8') as f:
        text = f.read().replace('\r\n', '\n')
    if 'store-service' in text:
        print('build.sh already packs the store service')
        return
    if BUILD_OLD not in text:
        sys.exit('patch_helper.py: this helper version is not the one FreeTV was made for (scripts/build.sh differs). '
                 'Use the commit pinned in install.sh.')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text.replace(BUILD_OLD, BUILD_NEW, 1))
    print('build.sh: the store service goes in FreeTV\'s package')


def main(helper):
    ws = os.path.join(helper, 'native', 'app', 'vendor', 'ws')
    if os.path.isdir(ws):
        shutil.rmtree(ws)
    shutil.copytree(os.path.join(ROOT, 'third_party', 'ws'), ws)
    print('ws 7.5.10 in place')
    patch_native(helper)
    patch_store(helper)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
