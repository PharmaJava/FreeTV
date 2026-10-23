#!/usr/bin/env python3
"""Two fixes for the Home button helper (Razdva122/clean-your-tv-lg-webos), applied to its folder by install.sh:

    python3 tools/patch_helper.py work/helper

1. ws 7.5.10 instead of ws 8. Some LG TVs run Node 8; ws 8 does not even load there (`catch {` and util.types are
   Node 10), so the helper dies at start and the Home button never works. ws 7.5.10 runs on Node 8 and newer.
2. Come back after Back. When an app exits, LG's home takes the screen; the helper opens FreeTV right away, but on some
   TVs LG's home then appears again a moment later and covers it. After returning, the helper now looks again and
   opens FreeTV again (up to five times) if LG's home is the one in front.

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


def main(helper):
    ws = os.path.join(helper, 'native', 'app', 'vendor', 'ws')
    if os.path.isdir(ws):
        shutil.rmtree(ws)
    shutil.copytree(os.path.join(ROOT, 'third_party', 'ws'), ws)
    print('ws 7.5.10 in place')

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
    print('native.js: return-after-Back retry added')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
