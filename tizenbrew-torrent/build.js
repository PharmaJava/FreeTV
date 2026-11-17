'use strict';
// Builds service.js (what TizenBrew downloads and runs on the TV) from src/service.js: torrent-stream and its dependencies bundled in one file,
// Node's own modules left as require() (TizenBrew hands the service its require). Run: npm install && npm run build
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const version = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version;
// torrent-stream's own parse-torrent-file throws on the empty announce list its engine encodes (bncode decodes `le` to something that is not an array on
// today's Node): the one line is made tolerant while bundling, and the build stops if the line is not where it was.
const fixParse = {
  name: 'fix-parse-torrent-file',
  setup(build) {
    build.onLoad({filter: /parse-torrent-file[\\/]index\.js$/}, (args) => {
      const from = 'result.announceList = announce.map(';
      const text = fs.readFileSync(args.path, 'utf8');
      if (text.indexOf(from) < 0) throw new Error('parse-torrent-file changed: update build.js');
      return {contents: text.replace(from, 'if (!Array.isArray(announce)) announce = []; ' + from), loader: 'js'};
    });
  }
};
(async () => {
await esbuild.build({
  plugins: [fixParse],
  entryPoints: [path.join(__dirname, 'src', 'service.js')],
  outfile: path.join(__dirname, 'service.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2017',
  legalComments: 'none',
  banner: {js: '/* Stremio Claude Torrents ' + version + ' for FreeTV: src/service.js with torrent-stream (MIT) and its dependencies. Built by build.js; do not edit. */\nvar global = this;'}
});
console.log('service.js built (' + Math.round(fs.statSync(path.join(__dirname, 'service.js')).size / 1024) + ' KB)');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
