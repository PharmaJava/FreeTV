# Changelog

FreeTV's version is the one in `home/appinfo.json`; the TV shows it while FreeTV starts (`home/splash.png`) and at the
bottom of *Home Settings*. Every change is also in the git history of `main`.

## 2.8.3 (2026-11-10)

### Fixed
- The Stremio Origin data test listed the app's own install files (its package, not data) and cut the paths. It lists folders that are not the install
  folder and anything named like web storage, with the whole path, and says whether the service may read them.

## 2.8.2 (2026-11-10)

### New
- **Test: where Stremio Origin keeps its data** (*Maintenance → Diagnostics*): the store service lists, read only (names and permissions, never contents),
  where `tv.stremioorigin.app` keeps its files on the TV and whether the service's shell may read them (`appDataProbe`), and adds it to the saved report. It
  answers whether *Continue watching* could show what was played inside a web app without the person's account.

## 2.8.1 (2026-11-10)

### Fixed
- **The RAM chip had a white band** behind it. It is transparent now, like the quotes under it, and turns into the white button only while it has the
  focus.

## 2.8.0 (2026-11-10)

**It opens at once.** Nothing from 2.7 was removed.

### Faster
- **The home is drawn at once when FreeTV starts.** It used to wait for the TV to answer with its list of apps and inputs (seconds on webOS 6,
  where the list comes through the remote API): until then there was only the title on an empty screen. The list of the last time is kept
  (`fmtv.appsCache`) and drawn straight away; the TV is still asked, and the home is drawn again only if the answer differs.
- **No white screen first.** `index.html` sets the background of the last start (night, pure black) before the styles load (`fmtv.boot`), and the
  text shows at once in the TV's own font while Inter (880 KB) loads (`font-display: swap`).
- **Coming back to FreeTV is lighter.** Every return (Home button, closing an app) rebuilt the shelf and the drawer; now only when the apps or
  inputs changed (`loadApps` tells its caller).

### RAM chip
- The RAM line is a **chip with the look of a button** (bigger, with *Free ›*). **▼ from the round buttons** reaches it (▶ past them still does),
  ▲ goes back, and from the last card ▲ goes to it. **OK or a click opens Memory**, where *Free memory now* is the first row.
- **Fixed: the pointer could not click it.** The hidden names of the round buttons (`.round .tip`) lay over it and took the clicks.

### Releases
- **Every version reaches the TVs by itself.** `.github/workflows/release.yml`: when `main` has a version with no release yet, GitHub builds
  the package (`tools/make_release.sh`) and publishes the release the TVs' *FreeTV updates* look for. Nothing to run on a computer.

### Fixed
- An error 220 ms after the picks went away while a card had the focus (`cardBackdrop` of nothing).

## 2.7.0 (2026-11-08)

### New
- **Apps from a GitHub link.** `Store.githubPackage` turns the latest release of `owner/repo` into a catalogue entry: the `.ipk` (id and version from its name),
  its SHA-256 from a `SHA256SUMS`/`.sha256` asset of the same release (none: refused), https://github.com download addresses only, `rootRequired` false,
  the «unofficial» confirmation always. Service methods `githubApps`, `githubAdd` (resolves before keeping), `githubRemove`; the person's links live in
  `state/github-repos.json`. The *Extra repositories* sheet takes a GitHub link or an `apps.json` address.
- **VodMax** (`silirim/VodMax`) comes with FreeTV as the first one (`GITHUB_DEFAULT`).

## 2.6.3 (2026-11-07)

### Fixed
- **The Store works when the main catalogue cannot be read.** On a network that answers `repo.webosbrew.org` with its own certificate (seen on a real
  TV: a self-signed one) nothing could be installed, not even from the other sources. The page and the service now keep going with the other sources
  (Stremio Origin, RezkaTV, repositories added by hand), checked the same way (https, no root, SHA-256). Certificates are still verified: nothing is
  bypassed. With none reachable the error is the same as before.

## 2.6.2 (2026-11-07)

### New
- **Stremio Origin in the Store**, as a third-party app (the same «unofficial» confirmation as RezkaTV): an unofficial native client for the person's own
  Stremio account and addons, from `stremio-origin.github.io/webos` (read only for `tv.stremioorigin.app`). Checked before adding it: `rootRequired`
  false, https, and its SHA-256 equals the one of the GitHub release. It is a week-old 1.0.0 by one person, unreviewed, tested only on webOS 4.4 (this TV
  is 6.5), and it plays torrents: the Store says so and FreeTV only checks the hash. The official Stremio of LG's store is the safe choice.

## 2.6.1 (2026-11-07)

### Fixed
- **Apps installed after FreeTV did not show up** (Stremio from LG's store could not go on the shelf): with the installer's list present, FreeTV never
  asked the TV for the real one. *Home Settings → Home → Refresh the list of apps* does (it needs the TV's permission to read the apps, asked once).

## 2.6.0 (2026-11-04)

### New
- **Companion:** a QR code (`home/qr.js`, a small maker of our own) leads the phone to a page served by `store-service/companion.js`, started
  by the service's `companionStart` through the TV's SSH and ended by `/bye` when the sheet closes (or after ten idle minutes). The page reads what
  was typed from 127.0.0.1 every two seconds. Three fields (name, note, news address), the token in the address, no libraries.

## 2.5.0 (2026-11-04)

### New
- **Diagnostics** (*Maintenance*): version, webOS, engine, memory, Developer Mode, store, updates, options and the last page errors, with no
  keys, names, city or PINs. Read on the TV, or saved there (`diagSave`, `state/diagnostics.txt`, with the service's own facts) and read on the
  computer with `node tools/diagnostics.js <IP>`. `.github/ISSUE_TEMPLATE/bug.md` asks for it.
- **My list:** hold OK on a pick (*put on / take off my list*, open its app); a sheet from *Maintenance* and the quick panel (off by default).
  Kept in the settings (`watchlist`, up to 60), so copies and updates carry it.

## 2.4.1 (2026-11-04)

Three reports from a GitHub user (LG OLED, Magic Remote MR25GA, v2.1.0):

### Fixed
- **The Magic Remote's pointer did nothing on the app shelf.** The closed drawer is a full-screen layer that is only moved down and made
  clear, and it lay over the shelf taking the pointer (`document.elementFromPoint` over any shelf app answered `#drawer`). It ignores the
  pointer while it is closed (`pointer-events: none`).
- **The pointer ran away down lists and along the cards.** A list that scrolls to keep the focused row in view moves the next row under a
  parked pointer, which sent mouseover, which moved the focus, which scrolled again. Only a pointer that really moved (3 px) focuses
  things now, and not faster than one change every 100 ms (a last stop is still taken). **New:** *Home Settings → Remote → Pointer
  sensitivity* (Slow 260 ms / Normal 100 ms / Fast 0).
- **The screensaver was semi-transparent with the Dark theme or the Pure black OLED style** (the night dimming was its opacity, and the Dark
  theme is always night). Already fixed in 2.2.0: it is solid and the dimming is a layer inside it. Checked again with Dark + OLED.

## 2.4.0 (2026-11-03)

**Where the RAM goes, and more to close.** Nothing from 2.3 was removed.

### New
- **Memory sheet:** memory kept for graphics (`CmaTotal`), the biggest processes of the TV in plain words (read-only: LG's web app engine, home,
  graphics, keyboard, AirPlay, HomeKit…; the store service's `sysinfo {procs}` now returns `top`, every process over 6 MB, named from
  `/proc/<pid>/comm`), **Free everything** (also the apps set to Keep, with a question), the **MB freed** after each close (free memory two
  seconds later), and *Also close LG's own apps* (`LG_CLOSABLE`: voice, browser, discovery, photos/video, music; off by default).
- **Settings → Maintenance:** *Memory: see it and free it*, *Free memory now*, *Free it by itself with the screensaver*, LG's apps.

### Measured on an LG OLED (webOS 6.5, 1.8 GB), nothing open
~196 MB kept for graphics and video, ~700 MB LG's own processes (web engine 207, graphics 65, home 50–73, keyboard 33, AirPlay 21,
HomeKit 14…), FreeTV itself ~35 MB, and any web app left in the background (a YouTube AdFree held ~240 MB). The Developer Mode shell
cannot close anything (`close`/`running` denied) and cannot change LG's settings; closing LG's services needs root.

## 2.3.1 (2026-11-03)

Found by updating a real TV from 2.2.0 to 2.3.0 (the update installed, but...):

### Fixed
- **A TV updated from GitHub lost its apps and suggestions.** The package of a release has no list of the TV's apps (the computer's installer
  makes it). Updating now first asks the TV (once) for permission to read its apps through the remote API, backs the key up with the
  settings, and only then installs; without the permission it does not update.
- The service forgot what the check had found when it exited between the check and the install ("Look for updates first"): the install
  asks the repository again.
- The script after the install waited ten minutes for the installer's call to end before opening FreeTV and cleaning up: it now waits for
  "installed" and lets go.
- The update dialog showed the release notes cut in half: only their first line now.

## 2.3.0 (2026-11-03)

**Close what you do not use.** Nothing from 2.2 was removed.

### New
- **Memory sheet** (the RAM line is now selectable; also a quick panel tile and a colour-key action): memory in use with a bar, the swap,
  the apps that can be closed with the MB each holds (the store service's `sysinfo {procs}` reads them from /proc for apps that name
  themselves in their command line), **Free memory now**, per-app close, *Keep/Close* per app (`ramKeep`, YouTube AdFree kept by default) and
  *free it with the screensaver* (`ramAuto`).
- Closing goes through LG's remote-control API (`ssap://system.launcher/close`, permission CLOSE, its own key `fmtv.ssapCloseKey`, asked once on the
  TV): the Developer Mode shell is denied `close` and `running`, so there is no other way. It is never used quietly without that key.

## 2.2.0 (2026-11-03)

**Lighter, and it updates itself.** Nothing from 2.1 was removed.

### New
- **FreeTV updates itself from its GitHub releases** (LG): *Home Settings → Maintenance → FreeTV updates* (tell me / automatic / never) and
  *FreeTV on GitHub*. `store-service/update.js` reads the latest release of the repository in `state/update-repo.txt` (default
  PharmaJava/FreeTV); `Store.selfUpdate` downloads `FreeTV-webos-<version>.ipk`, checks it against the release's `SHA256SUMS` and installs it
  with `/dev/install`, apart from the service (the package replaces it), then opens FreeTV. The settings, TMDB key and city survive: a build
  with them keeps a copy in `fmtv.cfg`, which is backed up with the rest, and a build without them takes it back (`home/data.js`).
  `tools/make_release.sh [--publish]` builds the package for everybody (`build_home.py --generic`) and makes the release.
- **RAM line** (*Widgets → RAM in use*): the TV's memory in use (the store service's `sysinfo`, read from /proc) and FreeTV's JS heap.
- **Smoothness** (*Look*): Automatic (times the first moves; under 32 fps it turns the smooth mode on), Smooth, Balanced, Pretty.
- **Store:** the catalogue is kept on the TV and refreshed behind it, three tries with a longer wait, the reason of a failure and *Try again*.

### Fixed
- **The screensaver mixed with the home:** the night dimming was the layer's opacity and it faded in over 1.2 s. It is solid and instant now
  (`#saver .dimmer` darkens inside it).
- Heavier than it needed to be: shadows were animated (repainted every frame), the round buttons, drawer and toast blurred all the time, the
  backdrop decoded a picture for every card the focus crossed, the power watcher asked LG every 0.7 s even with someone using the TV, and
  everything kept ticking while another app was in front. The store service no longer loads its SSH library to answer `sysinfo`.

## 2.1.0 (2026-10-28)

**Everything your way.** Nothing from 2.0 was removed.

### New
- **Remote shortcuts:** 1-9 open the shelf's apps, 0 All Apps; the four colour buttons do what the person chooses (*Home Settings → Remote*).
  Samsung asks Tizen for those keys.
- **Weather sheet:** 12 hours with rain chance, six days, feels-like, humidity, wind, UV index, air quality (Open-Meteo air quality API),
  rain in the next hour (minutely forecast).
- **Markets sheet:** the person's own quotes (Yahoo Finance symbols, Binance coins), 24-hour sparklines, a chart per quote (1d/5d/1mo/1y),
  price alerts, and any quote on the top row.
- **My widgets:** calendar with public holidays (Nager.Date), countdowns, notes and timed reminders, football (TheSportsDB), currencies,
  news from an RSS feed (read by the TV's store service: the screen cannot, no CORS; new `feed` method).
- **Store:** search, filters, order, "New" since the last visit, my list, size and free space, release notes from GitHub, Uninstall from the
  app's page, extra repositories; TV health counts new apps.
- **Look:** ready-made styles, dark by schedule, text size, glass strength, corners, app names under the icons, smaller cards, own background
  picture, landscapes by region.
- **Tabs** shown, hidden, reordered and renamed; **profiles** (Family, Kids, Guest) with their own shelf, tabs and look and an optional PIN.
- **Shortcuts:** named HDMI inputs on the shelf, any app onto the shelf or the quick panel, a YouTube channel onto the shelf, recent apps in
  the drawer.
- **Screensaver:** picture of the day (Wikimedia), astronomy (NASA APOD), an Immich shared album, a big moving clock, the weather on it,
  dimmer at night, the screen off after a while (LG).
- **Routines**, a **daily time limit** in kids mode, **time of use** per app, and **copies of the settings** on the TV and on the computer
  (`tools/settings_backup.js`).
- **Quick panel:** weather, markets, my widgets, profile, time of use, routines, and the person's apps.

## 2.0.0 (2026-10-28)

**Make it yours.** Nothing from 1.x was removed.

### New
- **Store with icons and descriptions.** Every community app shows its icon from the webOS Homebrew catalogue and one line
  about it, in your language for the apps people look for most (YouTube AdFree, Twitch AdFree, Jellyfin, Kodi, Moonlight,
  Plex, RetroArch, Homebrew Channel…). Its page shows the icon too.
- **Look:** seven accent colours (mint, blue, violet, rose, orange, amber, sky); a plain background besides the focused cover
  and landscapes; a **title** that can be a greeting for the time of day, with **your name** (typed with the TV's keyboard);
  **compact icons**; **reduced animations**.
- **Widgets:** the top clock on or off, 24 h / 12 h / automatic, and the date beside it.
- **Home:** when the screensaver starts (1, 2, 5, 10, 15, 30 minutes or never) and whether it shows its clock.
- **Quick panel you choose:** new tiles (theme, screensaver now, accent colour, All Apps, Store, TV Settings, Reload FreeTV)
  next to search, calm mode, sleep timer, kids mode, TV health and settings. *Home Settings → Quick panel* switches each one
  on or off; up to 12, in four columns.
- **Proper icons for Live TV and the Store** on the shelf (`tools/make_tiles.py`).
- **Version 2.0.0** on the start screen and in *Home Settings*.

### Fixed
- **LG's clock screensaver no longer covers ours.** FreeTV now answers LG's first notice ("Request Screen Saver") before the
  clock shows, watches whenever it is on screen (if LG's would start first, ours comes up instead), reconnects in 3 s, and a
  moment hidden no longer ends ours. On the TV: in 10 idle minutes LG tried 4 times and its clock never appeared.
- The quick panel's styles (class `tile`) also applied to the shelf: Live TV's and the Store's symbols sat in a corner and the
  focused app grew 4% instead of 20%. The panel's tiles are now `qtile`.

## 1.9.x (October 2026)

- **Home button and start-up stay on.** Holding Home stops them only until the TV is turned on again, and opening FreeTV turns
  them back on (*Home Settings → Home*, on by default). Before, an accidental long press left them off for good.
- **Start screen:** the TV shows FreeTV's logo, name and version while it starts, no longer "Free My TV".
- **LG's clock screensaver:** the permission that sends it away is asked while someone is looking (a prompt nobody answered
  no longer counts as a "no" for ever).
- **A clock** at the top right of the home screen.
- **Frosted glass** menus, **settings by section**, **quick panel**, **TV health**, **sleep timer**, **search**,
  **kids mode** with a PIN, **calm mode**, **accent colours**, **landscape background**, **first start guide**, notice of a new
  FreeTV version; tests (`tests/run.js`) and CI.
- **Store updates:** installed apps with their version, *Update*, *Update all*, optional daily automatic update.
- **Developer Mode** time left and automatic renewal from the TV itself; **LG privacy (ACR)** check; **settings survive a
  reinstall**; choose the **start tab**; hide LG's clutter from All Apps.
- **Custom tab:** add YouTube channels from the TV; hold OK menus; Continue watching.
- **Samsung:** community apps through TizenBrew; YouTube AdFree and Twitch AdFree on the shelf.
- **Screensaver** over LG's own, with landscapes and picks.
