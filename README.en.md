# FreeTV

**A clean, ad-free home screen for your TV, and a Home button that always takes you to it.**

**LG (webOS): tested** · Samsung (Tizen 2017+): experimental · Android TV and Google TV: Free My TV's app included · [what there is for each TV](docs/OTRAS-TELES.md)

[Versión en español](README.md) · [Guide to do it with any AI](docs/GUIA-IA.md) · [Troubleshooting](docs/PROBLEMAS.md)
(the guides are in Spanish for now; any AI can translate them for you)

![FreeTV on an LG OLED](docs/screenshot.png)

LG's home screen is full of ads. FreeTV sets it aside (it does not delete it) and puts its own: your apps as real square
icons, recommendations only from the services you have an account in, your city's weather and the market quotes you care
about. No rooting: it installs like any app through LG's **Developer Mode**, and **everything can be undone**.

## What it does

- **Home tabs:** **Custom** (the first), **Continue watching**, Explore, Movies and Shows.
  - **Custom:** shortcuts with a cover picture to children's YouTube channels (Bluey, Sofia the First, Minnie's Bow-Toons and Ms Rachel,
    always in English), opened in **YouTube AdFree** (install it from the Store) **in its TV screen**, not the website. A channel opens
    its newest video that can be watched now (live streams and premieres that have not started are skipped).
    **Add a channel from the TV, no computer:** press **+**, type the name (or @name) with the TV's keyboard and press Enter; the TV
    looks it up on YouTube and you pick the channel with the remote. **Hold OK** (or the Magic Remote's wheel, with the pointer on
    screen) on a channel to *Open*, *Move left/right* or *Remove*
    it (a short OK opens it). They can also be added from the computer: in `config.properties`, `kids_channels=Cocomelon|@Cocomelon`,
    then `bash install.sh <IP>`.
  - **Continue watching:** what you opened last from FreeTV (apps and channels), with the time. **Hold OK** to *Remove* one. The TV
    does not tell an app what another app played, so it cannot show the exact point of a series.
- **Real app icons.** The icons your TV provides, square and edge to edge, no frames. **Live TV** is one more icon on the
  shelf (by default where Apple TV would be).
- **Arrange your apps.** On the shelf, hold **OK** on an icon: it lifts; move it with ◀ ▶ and drop it with **OK**. The
  order is saved. The shelf holds 12; everything else is under *All Apps*.
- **Suggestions only from your accounts.** Trending films and series from TMDB, only from the services you switch on in
  *Home Settings → Suggestions* (no Disney+ or Apple TV picks if you have no account there). There you also choose whether
  to include animation and anime, and how many suggestions to show (6, 9, 12 or 18).
- **Real exploring.** The suggestions row slides right with ▶, and **every card says what it is and where to watch it**
  ("Series · Netflix", "Movie · Prime Video"). The first, wider one adds genre and length.
- **Markets in dollars:** Bitcoin, Ethereum, Solana and **XRP (Ripple)** (Binance), and iShares **S&P 500** and **NASDAQ 100**
  (CSPX and CNDX, in dollars). Each one can be switched off. Information only, not investment advice.
- **Weather** for your city, with sunrise and sunset; the screen goes dark at night.
- **An app store, on the TV itself.** The **Store** icon on the shelf (and *Home Settings → Community apps*) opens the
  [webOS Homebrew](https://repo.webosbrew.org) catalogue: ad-free YouTube, Kodi, Jellyfin, Moonlight, native Plex, RetroArch…
  Press OK on an app for its page and, if it **needs no root**, an **Install on this TV** button: the TV downloads the package,
  checks its SHA-256 hash and installs it, no computer (if you turn that on while installing FreeTV). Anything that needs root
  is **not installed**. See [Community apps](#community-apps-ad-free-youtube-kodi-jellyfin).
- **Its own screensaver.** After two idle minutes, full-screen photos with the clock: landscapes of Seville, Andalusia, Spain
  and Lithuania (Wikimedia Commons, free licences only, author and licence on screen), the picks' photos, or both. Chosen in
  *Home Settings → Screensaver*. No root needed. **It stays above LG's own screensaver** (the clock one): while FreeTV's is on, if
  the TV switches to its screensaver, FreeTV sends it away within a second or two. For that the TV asks **once** for permission
  (power state and screen): accept it.
- **A real Home button.** Press **Home** in any app and you come back to FreeTV, not LG's home. Leaving an app with
  **Back** brings you here too: the helper waits a bit over a second for LG to settle, then opens FreeTV once, with no
  back and forth. When the TV turns on, the helper opens FreeTV (on some TVs LG's home shows for a couple of
  seconds first).
- **Developer Mode renewal** (beta): LG's Developer Mode expires after ~40 days; *Home Settings → Developer Mode
  renewal* has a panel to renew it from the TV itself.
- **Emergency exit:** hold **Home** for 2 seconds and you are back on LG's home; FreeTV stops intercepting the button.

## What you need

- An **LG TV with webOS** (tested on an LG OLED).
- A **free LG developer account** (webostv.developer.lge.com) made **with email and password** (if you sign in with Apple
  or Google the TV cannot log in: use "forgot password" to set one).
- A **computer** on the same Wi-Fi as the TV, with **Linux, macOS or Windows with WSL**, and `git`, `python3` (3.9+) and
  `node` (20+) with `npm`.
- Optional: a **free TMDB key** (themoviedb.org → Settings → API) for the picks (and the picks' photos in the screensaver).
  It is yours and secret. The landscape screensaver and the store do not need it.

## Install, step by step

**1. On the TV (you do it).** LG Content Store → install **Developer Mode** → open it, sign in → **Dev Mode Status ON**
(the TV restarts) → open it again → **Key Server ON**. It shows the TV's **IP** and a **passphrase**. *The passphrase
changes every time you restart the Key Server and is private: never paste it in a chat.*

**2. On the computer.** Windows only: `wsl --install -d Ubuntu`, reboot, open *Ubuntu* and work there, in your home folder
(not in `/mnt/c`). Then:

```bash
sudo apt update && sudo apt install -y git python3 python3-venv python3-pip curl xz-utils   # macOS: brew install git python node
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

Reopen the terminal and `nvm install 22` (skip this if `node --version` already says 20 or more).

**3. Get FreeTV and set your data.**

```bash
git clone https://github.com/PharmaJava/FreeTV.git
cd FreeTV
cp config.example.properties config.properties
nano config.properties
```

Set your city (`city`, `latitude`, `longitude`) and `tmdb_region` (your country). Paste your TMDB key yourself in
`tmdb_key=` if you have one. In `hide_services=` list the services where you have **no** account (e.g. `disney`). This file
stays on your computer (it is in `.gitignore`).

**4. Install.**

```bash
bash install.sh 192.168.1.140
```

(with **your** TV's IP). It builds the home screen, downloads the Home button helper, patches it and installs it. It asks
for the **passphrase** (you type it) and the TV shows a **pairing prompt** you accept with the remote.

At the end it asks **one question**: *"Turn it on? [y/N]"*, about installing apps from the TV itself, with no computer. If you
say yes, the TV keeps this TV's Developer Mode key in a folder only the store service reads, so it can install by itself. The
default is **no**, and the store still works through the computer. You can take the key back any time:
`node tools/provision_store.js <IP> --forget`. To answer in advance: `FREETV_STORE=1 bash install.sh <IP>` (yes) or `FREETV_STORE=0` (no).

## Using it, updating, uninstalling

| You want to… | Do this |
|---|---|
| Go to FreeTV | **Home** button (or turn the TV on) |
| Open a channel for the children | **Custom** tab (the first) → **OK** on its cover |
| Add a YouTube channel | **Custom** → **+** → type the name with the TV keyboard → Enter → pick the channel |
| Move or remove a channel | **Custom** → **hold OK** on it |
| Remove something from Continue watching | **Continue watching** → **hold OK** on it → *Remove* |
| Uninstall an app | *All Apps* → **hold OK** on it → *Uninstall* → confirm (a short OK opens it). Only apps installed through Developer Mode (the Store's); LG's own must be deleted on LG's home |
| Move an icon on the shelf | Hold **OK** on it, ◀ ▶ to move, **OK** to drop |
| Choose the shelf apps | *Home Settings → Shelf* |
| Choose which services to suggest from, animation, how many | *Home Settings → Suggestions* |
| Install a community app | **Store** icon on the shelf → pick the app → **OK** → *Install on this TV* → confirm |
| Change the screensaver | *Home Settings → Screensaver* (landscapes, picks or both) |
| Go back to LG's home | Hold **Home** for 2 seconds |
| Turn the Home button back on | *Home Settings → Turn the Home button back on* |

**Developer Mode expires after about 40 days**: press **EXTEND** in the *Developer Mode* app now and then, or run
`bash install.sh <IP>` again. To change settings, edit `config.properties` and run `bash install.sh <IP>` again. To update
FreeTV: `git pull`, then the same.

Uninstall (from the `FreeTV` folder):

```bash
cd work/helper
export PATH="$PWD/build/tools/node_modules/.bin:$PATH"
ares-install -d clean-your-tv-192-168-1-140 -r com.gathin.tvhome
ares-install -d clean-your-tv-192-168-1-140 -r com.local.nativehome
```

## What it installs, and what it doesn't

Three things in the Developer Mode apps area: the **FreeTV** screen with its services (renewal and the **store**), and **Home
Helper**, which listens for the Home button. Only if you say yes to the question at the end: this TV's **Developer Mode key**, in
the store service's folder; it allows what your computer does (install and remove Developer Mode apps), nothing more, and
`--forget` takes it away. It does **not** root the TV, change firmware, touch picture, sound or network, or delete anything of
LG's. Your TV talks to TMDB, Open-Meteo, Binance, Yahoo Finance, Wikimedia Commons (screensaver) and, if you use the store,
`repo.webosbrew.org` and each package's address; nothing goes to any FreeTV server (there is none).

## No coding assistant? Use any AI

[docs/GUIA-IA.md](docs/GUIA-IA.md) has a text to paste into ChatGPT, Gemini, Claude, Copilot… that guides you step by
step. You press the remote and type your passphrase; the AI never needs it.

## Your TMDB key and GitHub

Your `config.properties` (with your TMDB key) is **never** uploaded: it is in `.gitignore`. The repository also has a check that
**blocks a commit** that would publish a key or a private file. If you plan to change FreeTV and push, turn it on once:
`git config core.hooksPath .githooks`. Check the whole history any time with `python3 tools/check_secrets.py --all`.

## Community apps (ad-free YouTube, Kodi, Jellyfin…)

The **Store** icon on the shelf (or *Home Settings → Community apps*) shows the webOS Homebrew catalogue and installs **the apps
that don't need root** (36 of 56): ad-free YouTube, Kodi, Jellyfin, Moonlight, native Plex, RetroArch, IPTV… Three ways to
install, all with the SHA-256 hash checked and your confirmation:

1. **From the TV itself, no computer** (if you said yes to the question at the end of `install.sh`): the **Install on this TV** button.
2. **Through the computer:** keep `python3 tools/community.py serve <IP>` running and use the same button on the TV.
3. **From the terminal:** `python3 tools/community.py install <id> <IP>`.

Anything that needs root is **not installed**: FreeTV does not root TVs. Some apps carry a warning you must accept on purpose
(ad-free YouTube requires deleting the official YouTube first, which can only be done on the TV). There is also one **unofficial**
extra (RezkaTV, by a third party) behind its own confirmation. The catalogue and the apps are made by other people: read before
installing. Details in [docs/COMUNIDAD.md](docs/COMUNIDAD.md) (Spanish).

## Other TVs

| TV | What there is | Status |
|---|---|---|
| **LG (webOS)** | Full FreeTV (this guide) | **Tested** on an LG OLED |
| **Samsung (2017+)** | The same screen, packaged in `tizen/`: [guide](docs/SAMSUNG.md) | **Experimental**: not tested by us on a Samsung |
| **Android TV / Google TV** | Free My TV's Android app in `android/`: [guide](docs/ANDROID-TV.md) | Included unchanged; not built or tested here; no FreeTV extras |
| Samsung up to 2016, Fire TV, Roku… | Nothing | [Alternative: a Google TV streamer on HDMI](docs/OTRAS-TELES.md) |

Got one of these? Tell us how it went in an [Issue](https://github.com/PharmaJava/FreeTV/issues).

## Tested, and limits

Tested on **one LG OLED** (Samsung and Android TV: see the table above) (webOS with Node 8.12 and Chrome 79): Home button, return after **Back**, reordering, quotes,
picks and the **store** (the TV's service opens its session, installs a package with its hash checked and refuses the dangerous
cases: root, wrong hash, an id outside the catalogue, an unconfirmed warning…). The `serve` variant (through the computer) was
tested with simulated tools, not on a TV. Kodi did not fit for lack of free space on the TV. Cold boot depends on your TV and firmware. Other LG models may differ. **Samsung and other brands are not supported
here.** Renewal is **beta** and unconfirmed on TVs without root.

## Credits

Built from [Free My TV](https://freemytv.io) (the home screen) and
[Razdva122/clean-your-tv-lg-webos](https://github.com/Razdva122/clean-your-tv-lg-webos) (Home button helper and renewal),
both MIT. See [NOTICE.md](NOTICE.md). This product uses the TMDB API but is not endorsed or certified by TMDB. FreeTV is not
affiliated with LG.
