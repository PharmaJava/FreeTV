#!/usr/bin/env bash
# FreeTV installer for LG webOS TVs: ./install.sh <TV IP address>
#
# What it does, in order:
#   1. builds FreeTV's home screen from home/ and your config.properties,
#   2. downloads the Home button helper (Razdva122/clean-your-tv-lg-webos) at the exact version FreeTV was tested with,
#   3. fixes it for TVs that run Node 8 and for the return after Back, and puts FreeTV's home in it,
#   4. runs the helper's own installer, which asks for your TV's Developer Mode passphrase and installs everything.
# Run it again with the same IP to update. Nothing leaves your computer except what goes to your TV.
# (FREETV_PREPARE_ONLY=1 ./install.sh <IP> does steps 1 to 3 and stops, to check everything without touching the TV.)
set -euo pipefail
cd "$(dirname "$0")"

HELPER_URL=https://github.com/Razdva122/clean-your-tv-lg-webos.git
HELPER_COMMIT=a5b4fdb6535911ba31a6507e92c1efdd4ef5f134

if [[ "${1:-}" == --help || "${1:-}" == -h || $# -ne 1 ]]; then
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi
TV_IP="$1"

for tool in python3 node npm git; do
  command -v "$tool" >/dev/null || { echo "Missing '$tool'. See the README (Requirements)." >&2; exit 1; }
done
[[ $(node -p 'Number(process.versions.node.split(".")[0])') -ge 20 ]] || { echo 'Node.js 20 or newer is needed on this computer.' >&2; exit 1; }
python3 -c 'import sys; sys.exit(sys.version_info < (3, 9))' || { echo 'Python 3.9 or newer is needed.' >&2; exit 1; }

echo '== 1/4 Building the home screen'
python3 tools/build_home.py
[[ -d out/home ]] || exit 1

echo '== 2/4 Getting the Home button helper'
mkdir -p work
if [[ ! -d work/helper/.git ]]; then
  git clone --quiet "$HELPER_URL" work/helper
fi
git -C work/helper fetch --quiet origin 2>/dev/null || true
git -C work/helper checkout --quiet --force "$HELPER_COMMIT"
git -C work/helper clean --quiet -fdx -e .venv -e build -e .lgtv-key.json -e dist

echo '== 3/4 Putting FreeTV in the helper'
# Two fixes for the helper (see tools/patch_helper.py): it must run on TVs with Node 8, and it must come back to FreeTV
# when an app exits and LG's home covers it again.
python3 tools/patch_helper.py work/helper
# FreeTV's home screen replaces the helper's own launcher (the helper opens the app id com.gathin.tvhome).
find work/helper/launcher -mindepth 1 -delete
cp -R out/home/. work/helper/launcher/

if [[ "${FREETV_PREPARE_ONLY:-}" == 1 ]]; then
  echo 'Prepared (FREETV_PREPARE_ONLY=1): nothing was installed on the TV.'
  exit 0
fi

echo '== 4/4 Installing on the TV (it will ask for the Developer Mode passphrase)'
cd work/helper
chmod +x install.sh
./install.sh "$TV_IP"

cat <<'EOF'

Done. On the TV: open an app and press Home, or turn the TV off and on again.
If something looks wrong, hold the Home button for 2 seconds to go back to LG's home screen.
EOF
