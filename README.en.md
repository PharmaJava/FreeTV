# FreeTV

**A clean, ad-free home screen for LG (webOS) TVs, and a Home button that always takes you to it.**

[Versión en español](README.md) · [Guide to do it with any AI](docs/GUIA-IA.md) · [Troubleshooting](docs/PROBLEMAS.md)
(the guides are in Spanish for now; any AI can translate them for you)

![FreeTV on an LG OLED](docs/screenshot.png)

LG's home screen is full of ads. FreeTV sets it aside (it does not delete it) and puts its own: your apps as real square
icons, recommendations only from the services you have an account in, your city's weather and the market quotes you care
about. No rooting: it installs like any app through LG's **Developer Mode**, and **everything can be undone**.

## What it does

- **Real app icons.** The icons your TV provides, square and edge to edge, no frames.
- **Arrange your apps.** On the shelf, hold **OK** on an icon: it lifts; move it with ◀ ▶ and drop it with **OK**. The
  order is saved. The shelf holds 12; everything else is under *All Apps*.
- **Picks only from your accounts.** Trending films and series from TMDB, only from the services you switch on in
  *Home Settings → Recommend from…* (no Disney+ picks if you have no Disney+ account).
- **Markets in dollars:** Bitcoin, Ethereum and Solana (Binance), and iShares **S&P 500** and **NASDAQ 100** (CSPX and
  CNDX, in dollars). Each one can be switched off. Information only, not investment advice.
- **Weather** for your city, with sunrise and sunset; the screen goes dark at night.
- **A real Home button.** Press **Home** in any app and you come back to FreeTV, not LG's home. Leaving an app with
  **Back** brings you here too. When the TV turns on, the helper opens FreeTV (on some TVs LG's home shows for a couple of
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
- Optional: a **free TMDB key** (themoviedb.org → Settings → API) for the picks. It is yours and secret.

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

## Using it, updating, uninstalling

| You want to… | Do this |
|---|---|
| Go to FreeTV | **Home** button (or turn the TV on) |
| Move an icon on the shelf | Hold **OK** on it, ◀ ▶ to move, **OK** to drop |
| Choose the shelf apps | *Home Settings → Shelf* |
| Choose which services to recommend from | *Home Settings → Recommend from…* |
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

Three things in the Developer Mode apps area: the **FreeTV** screen, its renewal service and **Home Helper**, which listens
for the Home button. It does **not** root the TV, change firmware, touch picture, sound or network, or delete anything of
LG's. Your TV talks to TMDB, Open-Meteo, Binance and Yahoo Finance; nothing goes to any FreeTV server (there is none).

## No coding assistant? Use any AI

[docs/GUIA-IA.md](docs/GUIA-IA.md) has a text to paste into ChatGPT, Gemini, Claude, Copilot… that guides you step by
step. You press the remote and type your passphrase; the AI never needs it.

## Tested, and limits

Tested on **one LG OLED** (webOS with Node 8.12 and Chrome 79): Home button, return after **Back**, reordering, quotes and
picks. Cold boot depends on your TV and firmware. Other LG models may differ. **Samsung and other brands are not supported
here.** Renewal is **beta** and unconfirmed on TVs without root.

## Credits

Built from [Free My TV](https://freemytv.io) (the home screen) and
[Razdva122/clean-your-tv-lg-webos](https://github.com/Razdva122/clean-your-tv-lg-webos) (Home button helper and renewal),
both MIT. See [NOTICE.md](NOTICE.md). This product uses the TMDB API but is not endorsed or certified by TMDB. FreeTV is not
affiliated with LG.
