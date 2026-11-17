# Stremio Claude Torrents (a TizenBrew module)

Torrents for FreeTV's Stremio Claude on Samsung TVs. A Samsung web app cannot open torrent connections; TizenBrew's service can run Node on the TV, so
the engine runs there as a **service module** and the Stremio page talks to it on `127.0.0.1:11470`.

- `src/service.js`: the engine (HTTP, a small part of Stremio's streaming server: `POST /<infoHash>/create`, `GET /<infoHash>/<fileIdx>` with Range, `GET /status`).
  One torrent at a time; the data of the last one is removed when another is chosen, when the service starts and after 20 idle minutes.
- `service.js`: what TizenBrew downloads and runs (from jsDelivr, pinned to a FreeTV release tag): `src/service.js` and [torrent-stream](https://github.com/mafintosh/torrent-stream)
  (MIT) with its dependencies in one file. Built by `build.js`; do not edit it. After changing `src/` run `npm install && npm run build` and commit the result.
- `package.json`: the module (`packageType: app`, `serviceFile: service.js`); `index.html`: the page TizenBrew shows if the module is opened by hand.
- `test/engine.e2e.js`: runs `service.js` the way TizenBrew does (a vm with the service's `require`) against a local seeder (`npm i webtorrent@1.9.7`, only for the test).

The Stremio page (`home/stremio/app.js`, `MODULE`) adds the module to TizenBrew with `ModuleAction` and starts it with `StartService` over TizenBrew's service
(`ws://127.0.0.1:8081`), only after the person says yes. `MODULE` names the release tag that has this folder (`gh/PharmaJava/FreeTV@v2.17.0/tizenbrew-torrent`):
when this folder changes, change that tag to the FreeTV version that has the change.

Needs Node 10 or newer in TizenBrew's service (checked here on 10, 12, 14 and 22; which Node each Samsung model gives it is not known).
