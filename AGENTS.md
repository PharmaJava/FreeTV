# FreeTV: notes for coding assistants

FreeTV is a home screen for **LG webOS** TVs plus a patched Home button helper. Plain web files in `home/`, Python 3
and shell for building; no bundlers, no frameworks.

## If a person asks you to install it for them

Read [`docs/GUIA-IA.md`](docs/GUIA-IA.md) first: it is written for exactly this. In short:

1. Ask for the **TV's IP**, their **city** and **country**, and which streaming services they have **no** account in.
2. **They** do the TV side (Developer Mode app → Dev Mode Status ON → Key Server ON) and type the **passphrase** themselves.
   **Never ask for, store or repeat the passphrase, their LG password or their TMDB key.** If they paste one, don't echo
   it and tell them to treat it as exposed (the passphrase changes by restarting Key Server).
3. Check tools: `git`, `python3` 3.9+, `node` 20+ with `npm`. On Windows everything runs inside **WSL (Ubuntu)**, in the
   Linux home folder, never in `/mnt/c` (CRLF line endings break the scripts).
4. `cp config.example.properties config.properties`, fill it (the TMDB key they paste themselves), never commit it.
5. `bash install.sh <IP>` (it prompts for the passphrase on a terminal you cannot type into: ask them to run it).
   `FREETV_PREPARE_ONLY=1 bash install.sh <IP>` runs everything except the TV part and is safe to run yourself.
6. Check: `ares-novacom ... tail controller.log` (see `docs/PROBLEMAS.md`).

## Rules

- Never commit `config.properties`, keys, `work/`, `out/` or `*.ipk`. `tools/check_secrets.py` (pre-commit hook in `.githooks`)
  blocks commits that would publish a key; run `python3 tools/check_secrets.py --all` before pushing.
- Do not root the TV, change firmware or touch picture, sound or network settings. Everything is reversible:
  hold Home 2 s (emergency exit), `ares-install -r <app id>` (uninstall).
- The home screen is **ES5 + CSS without variables or grid** (old TVs). Only transform and opacity animate. No new
  libraries. Text goes through `tr(pt, en, es)`.
- The helper (Razdva122/clean-your-tv-lg-webos) is **downloaded at a pinned commit** by `install.sh` and patched by
  `tools/patch_helper.py`; if you bump the commit, re-check that the two patches still apply and run the helper's files
  under Node 8 (`node --check`; the TVs run 8.12).
- After a change to `home/`: `python3 tools/build_home.py`, then `for f in out/home/*.js; do node --check $f; done`.

## Layout

| Path | What |
|---|---|
| `home/` | The app the TV runs: `index.html`, `home.js` (UI, keys), `data.js` (weather, quotes, picks), `tv.js` (TV services), `renewal.js`, `extras.js`, `helper-control.js`, `native-bootstrap.js` |
| `assets/`, `third_party/ws/` | Icons, font, and ws 7.5.10 |
| `tools/make_landscapes.py` | Rebuilds `home/landscapes.js`, the screensaver's photos (Wikimedia Commons, free licences only, author and licence kept and shown). Slow on purpose |
| `tools/kids_channels.py` | The Custom tab's YouTube shortcuts (defaults + `kids_channels=` in config): looks each one up, saves its cover picture to `work/channels/` and refuses a video that is not on the channel it should be (children's content). Pictures are other people's logos: never commit them |
| `tools/build_home.py` | Builds `out/home` from `home/` and `config.properties` |
| `tools/patch_helper.py` | The two helper fixes |
| `install.sh` | The whole install (LG) |
| `store-service/`, `tools/provision_store.js` | The Store on the TV: a Luna service (Node 8) that opens the TV's own Developer Mode SSH (`127.0.0.1:9922`) and runs what `ares-install` runs (curl, sha256sum, luna-send-pub). Its key is put in `state/key.pem` once, only if the person said yes in `install.sh`; `--forget` removes it. **Never print the key; never provision without their yes.** Old BusyBox on the TV: `timeout -t N cmd`. Test the same code from the computer with `node tools/store_selftest.js <IP> [id]` The same service has `channels` (`youtube.js`): the Custom tab's "+" searches YouTube channels from the TV (no key; the page cannot, no CORS). It runs on Node 8.12: no `https.get(url, options, cb)`, no optional chaining. |
| `tools/community.py` | Installs community apps from the webOS Homebrew catalogue: no-root only, SHA-256 checked, asks first. Cautions live here (`CAUTION`) and in `home/home.js` (`COMM_CAUTION`, flags in `COMM_FLAG`): keep them in step. `serve` lets the TV's
Community screen install through the computer (the TV app itself cannot install without root); it answers only the TV's IP, only catalogue
ids, and every install is confirmed on the TV. The TV side of it (launch params from `ares-launch -p`) is untested on real hardware. **Never install anything on the person's TV without their yes for that app.** Store/LG apps cannot be removed from the computer (`FAILED_REMOVE`); installing an app whose id belongs to a store app (YouTube AdFree) while the original is present half-breaks the original's launcher entry: the person must delete the original on the TV first |
| `home/tizenbrew.js` | Samsung only: TizenBrew's modules (YouTube AdFree = TizenTube, Twitch AdFree = Twizen, the Store's search on npm). Opens a module with an app control to TizenBrew, lists/adds/removes them over TizenBrew's service (`ws://127.0.0.1:8081`, only up once TizenBrew was opened). Always ask before adding a module |
| `tizen/` | Samsung: `build.py` (unsigned/signed .wgt), `install.py` (SDB over Wi-Fi). Experimental, untested by us on a Samsung |
| `android/` | Free My TV's Android app, unchanged (`build.sh`, `app/`). Not built or tested by us. Never commit its `config.properties`, `*.keystore` or `*.apk` |

## Debugging the live screen

`ares-inspect -d <device> com.gathin.tvhome` prints a DevTools URL (`ws://localhost:<port>/devtools/page/<id>`). Over that
WebSocket (Chrome DevTools Protocol) you can `Runtime.evaluate`, `Page.captureScreenshot` and send keys with
`Input.dispatchKeyEvent` (call `Page.bringToFront` and `Emulation.setFocusEmulationEnabled` first, or the page ignores
keys). `Prefs` (settings) and `Data` (weather, quotes, picks) are globals. Put the reset values back after tests: they
live in the person's `localStorage` (`fmtv.prefs`).
