# Credits and licenses

FreeTV stands on other people's work. Thank you.

| What | Who | License | Where in this repo |
|---|---|---|---|
| The home screen's design and code (`home/`, started from it) | [Free My TV](https://freemytv.io) contributors | MIT | `licenses/Free-My-TV-MIT.txt` |
| The Samsung packaging and installer (`tizen/`, `assets/samsung-icons/`) and the whole Android app (`android/`), **included as Free My TV made them** | [Free My TV](https://freemytv.io) contributors | MIT | `licenses/Free-My-TV-MIT.txt` |
| The Home button helper, its Developer Mode renewal service and the recovery code (`home/helper-control.js`). **Downloaded by `install.sh`, not copied here** | [Razdva122/clean-your-tv-lg-webos](https://github.com/Razdva122/clean-your-tv-lg-webos) | MIT | `licenses/clean-your-tv-lg-webos-MIT.txt` |
| The list of community apps (read at run time, **nothing of it is bundled**) | [webOS Homebrew Project](https://www.webosbrew.org) | Each app has its own license (youtube-webos is GPL-3.0) | `https://repo.webosbrew.org` |
| `ssh2` 0.8.9 and its dependencies (`ssh2-streams`, `asn1`, `bcrypt-pbkdf`, `safer-buffer`, `streamsearch`, `tweetnacl`), in the TV-side store service. Installed from `package-lock.json` by `install.sh`, not copied here | Brian White and contributors, and the others' authors | MIT / BSD-3-Clause / Unlicense | `store-service/package-lock.json` |
| `ws` 7.5.10, a WebSocket library, swapped into the helper so it runs on TVs with Node 8 | Einar Otto Stangvik and contributors | MIT | `third_party/ws/LICENSE` |
| Inter, the font | The Inter Project Authors | SIL OFL 1.1 | `assets/fonts/OFL.txt` |
| Material Symbols, the small icons | Google | Apache 2.0 | `assets/symbols/LICENSE-material-symbols.txt` |

Film and series data and images come from TMDB. **This product uses the TMDB API but is not endorsed or certified by
TMDB.** Weather comes from Open-Meteo, crypto prices from Binance, and the S&P 500 and NASDAQ 100 fund prices from Yahoo
Finance (justETF as a fallback). Those are unofficial or free public endpoints: they can change or stop without notice,
and the prices are information, not investment advice.

The screensaver's landscape photos (`home/landscapes.js`) are not copied into this repository: the TV loads them from Wikimedia
Commons, and each one is shown with its author and licence (public domain, CC0, CC BY or CC BY-SA). RezkaTV, offered in the store
as an unofficial extra, is a third-party app (MIT) that this project does not make or endorse.

FreeTV is not affiliated with, endorsed by or sponsored by LG Electronics. "LG" and "webOS" belong to their owners.
Netflix, YouTube, Prime Video, Disney+ and the other app icons shown on the home screen are the icons your own TV gives
to apps already installed on it.
