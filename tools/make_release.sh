#!/usr/bin/env bash
# Builds the LG package of a FreeTV release (with none of your settings in it) and, with --publish, makes the GitHub release that the
# TVs' "FreeTV updates" look for:
#
#   bash tools/make_release.sh              builds release/FreeTV-webos-<version>.ipk and release/SHA256SUMS
#   bash tools/make_release.sh --publish    ... and creates the release v<version> on GitHub with them (needs `gh` signed in)
#
# The version is home/appinfo.json's; its section in CHANGELOG.md is the release's notes. Needs what install.sh needs, and that
# FREETV_PREPARE_ONLY=1 bash install.sh <IP> has run once (it gets the Home button helper, whose packaging this uses).
# A TV that updates from this package keeps its own settings, TMDB key and city: they live on the TV (see home/data.js).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
VERSION=$(python3 -c 'import json; print(json.load(open("home/appinfo.json"))["version"])')
[[ -d work/helper/store-service && -f work/helper/scripts/fix-store-package.py ]] || { echo 'Run FREETV_PREPARE_ONLY=1 bash install.sh <any IP> once first.' >&2; exit 1; }
command -v ares-package >/dev/null || { echo 'ares-package is not in the PATH (LG webOS CLI).' >&2; exit 1; }

echo "== Building FreeTV $VERSION for everybody (no key, no city)"
python3 tools/build_home.py --generic --config config.example.properties
if grep -q '"tmdbKey": "[^"]' out/home/config.js; then echo 'The package carries a TMDB key: stopping.' >&2; exit 1; fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
mkdir "$WORK/launcher"
cp -R out/home/. "$WORK/launcher/"
cp -R work/helper/renewal-service work/helper/scripts "$WORK/"
# the store service from this repository (not the helper's older copy), with the one library it needs
[[ -d store-service/node_modules/ssh2 ]] || (cd store-service && npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null)
cp -R store-service "$WORK/store-service"
rm -rf "$WORK/store-service/state"; mkdir "$WORK/store-service/state"; touch "$WORK/store-service/state/.keep"
(cd "$WORK" && ares-package launcher renewal-service store-service -o dist >/dev/null \
  && python3 scripts/fix-store-package.py "dist/com.gathin.tvhome_${VERSION}_all.ipk")
mkdir -p release
NAME="FreeTV-webos-${VERSION}.ipk"
cp "$WORK/dist/com.gathin.tvhome_${VERSION}_all.ipk" "release/$NAME"
(cd release && sha256sum "$NAME" > SHA256SUMS)
if unzip -p "release/$NAME" data.tar.gz 2>/dev/null | tar -xzO 2>/dev/null | grep -q 'key.pem'; then echo 'A key is in the package: stopping.' >&2; exit 1; fi
echo "Built release/$NAME ($(du -k "release/$NAME" | cut -f1) KB)"; cat release/SHA256SUMS

if [[ "${1:-}" == --publish ]]; then
  python3 - "$VERSION" > release/NOTES.md <<'PY'
import re, sys
v = sys.argv[1]
text = open('CHANGELOG.md', encoding='utf-8').read()
m = re.search(r'^## %s[^\n]*\n(.*?)(?=^## |\Z)' % re.escape(v), text, re.S | re.M)
print((m.group(1).strip() if m else 'FreeTV %s' % v) + '\n\nFor LG TVs: Home Settings → Maintenance → FreeTV updates installs it, or `bash install.sh <IP>`. SHA-256 in SHA256SUMS.')
PY
  gh release create "v$VERSION" "release/$NAME" release/SHA256SUMS --title "FreeTV $VERSION" --notes-file release/NOTES.md
fi
