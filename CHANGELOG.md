# Changelog

FreeTV's version is the one in `home/appinfo.json`; the TV shows it while FreeTV starts (`home/splash.png`) and at the
bottom of *Home Settings*. Every change is also in the git history of `main`.

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
