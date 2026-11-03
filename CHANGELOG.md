# Changelog

FreeTV's version is the one in `home/appinfo.json`; the TV shows it while FreeTV starts (`home/splash.png`) and at the
bottom of *Home Settings*. Every change is also in the git history of `main`.

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
