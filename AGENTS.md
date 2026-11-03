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
| `store-service/`, `tools/provision_store.js` | The Store on the TV: a Luna service (Node 8) that opens the TV's own Developer Mode SSH (`127.0.0.1:9922`) and runs what `ares-install` runs (curl, sha256sum, luna-send-pub). Its key is put in `state/key.pem` once, only if the person said yes in `install.sh`; `--forget` removes it. **Never print the key; never provision without their yes.** Old BusyBox on the TV: `timeout -t N cmd`. Test the same code from the computer with `node tools/store_selftest.js <IP> [id]` Updates: `updates` (installed versions from `dev/listApps` vs the catalogue, `isNewer` in store.js) and `updateAll` (one after the other; job.batch has the progress; apps with a CAUTION flag other than official-removed are never in the batch); `install` takes `update:true`. Home Settings → *Update apps by itself* (`Prefs.autoUpdate`, off by default, checked once a day by `autoUpdate()` in home.js). The service process exits when idle: a call after a pause takes ~25 s (Node 8 cold start). It also has: `devmode` (LG's Developer Mode session: `CheckDevModeSession.dev` / `ResetDevModeSession.dev` with the token read **inside** the TV's shell command, never printed or logged; extends when < 14 days are left; history in `state/devmode.json`), `prefsSave`/`prefsLoad` (a copy of the page's localStorage in `state/prefs.json`, restored once on a fresh install: a reinstall empties the page's storage but keeps `state/`), `privacy` (reads `/tmp/acr.xml`: LG's ACR state) and `hardenState` (a reinstall makes `key.pem` world-readable: the service puts it back to 640 over its own shell). The same service has `channels` (`youtube.js`): the Custom tab's "+" searches YouTube channels from the TV (no key; the page cannot, no CORS). It runs on Node 8.12: no `https.get(url, options, cb)`, no optional chaining. |
| `tools/community.py` | Installs community apps from the webOS Homebrew catalogue: no-root only, SHA-256 checked, asks first. Cautions live here (`CAUTION`) and in `home/home.js` (`COMM_CAUTION`, flags in `COMM_FLAG`): keep them in step. `serve` lets the TV's
Community screen install through the computer (the TV app itself cannot install without root); it answers only the TV's IP, only catalogue
ids, and every install is confirmed on the TV. The TV side of it (launch params from `ares-launch -p`) is untested on real hardware. **Never install anything on the person's TV without their yes for that app.** Store/LG apps cannot be removed from the computer (`FAILED_REMOVE`); installing an app whose id belongs to a store app (YouTube AdFree) while the original is present half-breaks the original's launcher entry: the person must delete the original on the TV first |
| `home/tizenbrew.js` | Samsung only: TizenBrew's modules (YouTube AdFree = TizenTube, Twitch AdFree = Twizen, the Store's search on npm). Opens a module with an app control to TizenBrew, lists/adds/removes them over TizenBrew's service (`ws://127.0.0.1:8081`, only up once TizenBrew was opened). Always ask before adding a module |
| `tests/run.js` | `node tests/run.js`: the store service's logic with a mocked TV shell (versions, updates, Developer Mode renewal) and a parse check of `home/`. CI (`.github/workflows/ci.yml`) runs it, `tools/check_secrets.py --all` and a keyless build on every push. Run it before pushing |
| `tools/make_symbols.py` | Draws FreeTV's own symbols (search, kids, health, calm, lock, timer, tiles) into `assets/symbols/`, same weight as the Material ones |
| `tizen/` | Samsung: `build.py` (unsigned/signed .wgt), `install.py` (SDB over Wi-Fi). Experimental, untested by us on a Samsung |
| `android/` | Free My TV's Android app, unchanged (`build.sh`, `app/`). Not built or tested by us. Never commit its `config.properties`, `*.keystore` or `*.apk` |

## Debugging the live screen

`ares-inspect -d <device> com.gathin.tvhome` prints a DevTools URL (`ws://localhost:<port>/devtools/page/<id>`). Over that
WebSocket (Chrome DevTools Protocol) you can `Runtime.evaluate`, `Page.captureScreenshot` and send keys with
`Input.dispatchKeyEvent` (call `Page.bringToFront` and `Emulation.setFocusEmulationEnabled` first, or the page ignores
keys). `Prefs` (settings) and `Data` (weather, quotes, picks) are globals. Put the reset values back after tests: they
live in the person's `localStorage` (`fmtv.prefs`).

## Look and menus (home.js)

Menus are frosted glass (`frostWanted()`, class `frost` on `body`; a sheet must keep a fixed opacity and fade only its `.box`, or the blur disappears during the fade). Settings are sections (`settingCats()`, `settingRows()`), the quick panel and TV health are tile sheets (`openTiles`, `quickTiles`, `healthTiles`), plus search, sleep timer, kids mode with a PIN, calm mode and accent colours. Sleep timer, health and the first start guide are webOS only (`TV.name === 'webos'`); the rest is shared with Samsung. New text goes through `tr(pt, en, es)` and, for German and Russian, `home/strings.js`. Text and screenshots of a change belong in the README (both languages).

## Start screen and LG's screensaver

`home/appinfo.json` is titled FreeTV and its `splashBackground` is `home/splash.png`: after changing the version, run `python3 tools/make_splash.py` (tests/run.js fails otherwise). LG's clock screensaver is sent away by `TV.holdScreen` through the remote control API, which needs the TV's yes once: `TV.pairScreen` asks it a few seconds after FreeTV is on screen, never when the screensaver starts (nobody answers then, and old versions kept that as a no for ever). `registerScreenSaverRequest` subscribes from a Developer Mode app, but in 9 idle minutes on webOS 6.5 LG sent it no request, so it is not used.

## The Home button's stop

Holding Home stops the helper and leaves `state/blocked` in `com.local.nativehome`; LG's automatic launch at power-on used to respect it for ever. `tools/patch_helper.py` (patch 4) makes a marker from before the TV started, or older than ten minutes, count as old. In FreeTV, Home Settings → Home shows the state (`HomeExtras.homeRows`, fed by `helper-control.js`) and `Prefs.homeAuto` (on by default) resumes the helper when FreeTV opens. The helper's log is `state/controller.log` (worker `EXIT 22` is a long Home press).

## 2.0: options, the quick panel, the Store's rows

- New choices are read with `Prefs.opt(name, default)` (`iconSize`, `motion`, `titleMode`, `name`, `topClock`, `topDate`, `clock24`, `saverAfter`, `saverClock`, `quickHidden`); accents live in `ACCENTS` (data.js) with their CSS under `body.acc-<name>`.
- The quick panel's tiles come from `quickDefs()` (each with an `id`; `lg: true` for webOS only); `QUICK_OFF` are hidden until the person turns them on. Its tiles use the class `qtile`: the shelf's are `tile`, keep them apart.
- Store rows: `commIcon()` (catalogue `iconUri`, a letter when it fails) and `commDesc()` (`COMM_DESC` in three languages, else the catalogue's `shortDescription`). Lists with taller rows set `data-pitch` and `data-visible` on `.rows`.
- Shelf icons FreeTV draws itself: `tools/make_tiles.py` → `assets/tiles/`, used through an app's `tile` field.
- Changing the version: `home/appinfo.json`, `tizen/config.xml`, `python3 tools/make_splash.py`, and a section in `CHANGELOG.md`.

## 2.1: info sheets and the rest

- `openInfo(kind, arg)` shows a wide glass sheet: `INFO[kind](arg)` returns `{title, icon, build(box), rows, visible, hint, back}`; rows work
  like Home Settings' (`toggle`, `value` with ‹ ›, `'›'`, `plain`, `run`, `step`, `move` for ◀ ▶). Kinds: weather, markets, addTicker, ticker,
  widgets, profiles, tabs, routines, usage, inputs, repos. A sheet's data callbacks must only redraw when something new arrived (a cached answer
  that redraws loops).
- `runAction(name)` is what the colour keys and routines run; `shortcutKey(k)` handles 0-9 and 403-406.
- Tabs: `VIS` maps the top row's places to the real tabs (0 Custom, 1 Continue watching, 2-4 picks); always go through it.
- Profiles copy `PROFILE_KEYS` of the prefs in and out (`switchProfile`).
- The Store keeps the whole catalogue in `commAll`; `commRebuild()` makes `commList` (search, filter and order rows, "Update all", the apps).
- Names that depend on the language are computed when shown (`rangeName`, `inputKind`), never in a top-level `var`: `tr()` runs before the
  language is set.
- Network sources: Open-Meteo (forecast and air), Yahoo Finance and Binance, Nager.Date, TheSportsDB (test key 123), Wikimedia featured feed,
  NASA APOD (DEMO_KEY), GitHub releases, an Immich shared link, RSS through the store service's `feed`.
- German and Russian are not kept up to date for the 2.0/2.1 texts (the person asked for Spanish, English and Portuguese only).

## 2.2: updates, lighter home

- **Releases and self-update.** `tools/make_release.sh [--publish]` builds `release/FreeTV-webos-<version>.ipk` and `SHA256SUMS` with
  `build_home.py --generic` (no key, no city) and makes the GitHub release `v<version>`; the TVs' service (`update.js`) only accepts assets
  of that repository. Never publish a package built from your own `config.properties`. To test an update on a TV: publish the release, then
  put an older version on the TV (`bash install.sh`) and use *Maintenance → FreeTV on GitHub*.
- **A package without settings must find them on the TV:** `fmtv.cfg` (written by `home/data.js` when a build has a key or a city; in
  `SAVED_KEYS` and the service's `PREF_KEYS`). Add a new build-time setting to `KEYS` there.
- **Smoothness:** `body.lite` (smooth) and `body.blurhome` (pretty) are decided in `applyLook` from `perfNow()`; a persistent element must
  not use `backdrop-filter` outside `body.blurhome`, and no transition may animate `box-shadow`.
- **The service must stay light:** `service.js` loads `store.js`/`youtube.js` (and so ssh2) only when a method needs them: `sysinfo` is
  called every 15 s while FreeTV is on screen.
- The dev shell cannot close other apps (`luna-send` is denied to it): the RAM line shows the cause, it cannot free it.

## 2.3: closing apps

- `TV.closeApps(ids, quiet, done)` (tv.js) opens a session on ws://127.0.0.1:3000 with the permission CLOSE (own key `fmtv.ssapCloseKey`, refusal
  `fmtv.ssapCloseRefused`) and sends `system.launcher/close` for each id; an app that was not running answers with an error and that is fine.
  Quiet calls (the screensaver's) never prompt. `closable()` (home.js) leaves out FreeTV (`PROTECTED`), `com.webos.app.*`, inputs and channels.
- The RAM line is the top row's stop `TABS + 3` (only on webOS, `memShown()`).
- Not verified on a TV when written (the TV was in use): the prompt's wording and what `close` answers for an app that is not running.

## 2.4: reading the TV's memory
- `sysinfo {procs:true}` returns `apps` (MB per app that names itself), `top` (processes over 6 MB with `n` from `/proc/<pid>/comm`, `kind`
  renderer/helper from the command line) and `cma`. `sysWhat()` (home.js) names the usual ones; add a name there when a new one shows up.
- Web apps cannot be attributed to a process (their renderers do not name the app): the sheet says "a web app", and the MB freed is measured.
- Escapes: code written into files from Python must keep `\d`/`\S` as one backslash (a doubled one silently matches nothing: process names read `?`).

