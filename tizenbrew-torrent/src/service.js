'use strict';
/*
 * Torrents for Stremio Claude on Samsung (FreeTV). A Samsung web app cannot open torrent connections, but TizenBrew's service can run
 * Node on the TV: this is a TizenBrew service module. FreeTV's Stremio page starts it through TizenBrew and talks to it on 127.0.0.1.
 * It speaks the small part of Stremio's streaming server the page needs:
 *   POST /<infoHash>/create   {torrent:{infoHash}, peerSearch:{sources:[...]}, guessFileIdx:{}, peers:[...]}  -> {files, guessedFileIdx}
 *   GET  /<infoHash>/<fileIdx>                                                                            -> the file, with Range
 *   GET  /status                                                                                          -> {ok, ...}
 * One torrent at a time (the TV has little room): a new one removes the data of the last. Nothing is shared with anyone but the swarm
 * the torrent itself belongs to, and nothing is kept after the TV forgets it. Plain ES2015 on purpose: the Node that TizenBrew gets can be old.
 * TizenBrew runs this file in a vm with its own `require` (core modules only; everything else is bundled in by build.js).
 */
var http = require('http');
var fs = require('fs');
var os = require('os');
var path = require('path');
var torrentStream = require('torrent-stream');

var PORT = Number(process.env.FREETV_TORRENT_PORT) || 11470;
var HOST = process.env.FREETV_TORRENT_HOST || '127.0.0.1';
var VERSION = '1.0.0';
var METADATA_MS = Number(process.env.FREETV_TORRENT_METADATA_MS) || 90000;
var IDLE_MS = 20 * 60 * 1000;
var VIDEO = /\.(mkv|mp4|m4v|avi|mov|webm|ts|m2ts|wmv|flv|mpg|mpeg)$/i;
var TYPES = {mkv: 'video/x-matroska', mp4: 'video/mp4', m4v: 'video/mp4', avi: 'video/x-msvideo', mov: 'video/quicktime', webm: 'video/webm',
  ts: 'video/mp2t', m2ts: 'video/mp2t', wmv: 'video/x-ms-wmv', flv: 'video/x-flv', mpg: 'video/mpeg', mpeg: 'video/mpeg'};

function log() { try { console.log.apply(console, ['[freetv-torrents]'].concat([].slice.call(arguments))); } catch (e) { /* no console */ } }

// ---- where the data goes --------------------------------------------------------------------------------------------------------
function writable(dir) {
  try {
    mkdirs(dir);
    var probe = path.join(dir, '.probe');
    fs.writeFileSync(probe, 'x');
    fs.unlinkSync(probe);
    return true;
  } catch (e) { return false; }
}
function mkdirs(dir) {
  if (fs.existsSync(dir)) return;
  mkdirs(path.dirname(dir));
  try { fs.mkdirSync(dir); } catch (e) { if (!fs.existsSync(dir)) throw e; }
}
function rmrf(p) {
  try {
    var st = fs.lstatSync(p);
    if (st.isDirectory()) {
      fs.readdirSync(p).forEach(function (n) { rmrf(path.join(p, n)); });
      fs.rmdirSync(p);
    } else fs.unlinkSync(p);
  } catch (e) { /* already gone */ }
}
var DIR = (function () {
  var wanted = [process.env.FREETV_TORRENT_DIR, '/home/owner/share/freetv-torrents', path.join(os.tmpdir(), 'freetv-torrents')], i;
  for (i = 0; i < wanted.length; i++) if (wanted[i] && writable(wanted[i])) return wanted[i];
  return null;
})();
function freeBytes(dir, cb) {
  try {
    if (typeof fs.statfs === 'function') {
      fs.statfs(dir, function (err, s) { cb(err ? -1 : s.bavail * s.bsize); });
      return;
    }
    require('child_process').exec('df -Pk "' + dir + '"', {timeout: 4000}, function (err, out) {
      var m = !err && /\n\S+\s+\d+\s+\d+\s+(\d+)\s/.exec(String(out));
      cb(m ? Number(m[1]) * 1024 : -1);
    });
  } catch (e) { cb(-1); }
}

// ---- torrents -------------------------------------------------------------------------------------------------------------------
var current = null;   // {hash, engine, dir, ready, error, files, waiting: [cb], last, timer}

function stop(t) {
  if (!t) return;
  clearTimeout(t.timer);
  try { t.engine.destroy(function () { rmrf(t.dir); }); } catch (e) { rmrf(t.dir); }
  if (current === t) current = null;
}
function fileList(engine) {
  return engine.files.map(function (f, i) { return {index: i, name: f.name, path: f.path, length: f.length}; });
}
function guess(files) {
  var best = -1, size = -1, i;
  for (i = 0; i < files.length; i++) if (VIDEO.test(files[i].name) && files[i].length > size) { size = files[i].length; best = i; }
  return best >= 0 ? best : (files.length ? 0 : -1);
}
function trackersOf(sources) {
  var out = [];
  (sources || []).forEach(function (s) {
    s = String(s);
    if (/^tracker:/i.test(s)) out.push(s.slice(8));
    else if (/^(udp|http|https|wss?):\/\//i.test(s)) out.push(s);
  });
  return out.slice(0, 30);
}
/** Opens (or reuses) the torrent; cb(err, t) once its file list is known. */
function open(hash, body, cb) {
  if (current && current.hash === hash && !current.error) {
    current.last = Date.now();
    if (current.ready) { cb(null, current); return; }
    current.waiting.push(cb);
    return;
  }
  stop(current);
  if (!DIR) { cb({code: 500, message: 'no folder to keep the torrent in'}); return; }
  var dir = path.join(DIR, hash);
  rmrf(dir);
  var trackers = trackersOf(body && body.peerSearch && body.peerSearch.sources);
  var magnet = 'magnet:?xt=urn:btih:' + hash + trackers.map(function (t) { return '&tr=' + encodeURIComponent(t); }).join('');
  var t = {hash: hash, dir: dir, ready: false, error: null, files: [], waiting: [cb], last: Date.now(), timer: null, engine: null};
  current = t;
  function finish(err) {
    var w = t.waiting;
    t.waiting = [];
    if (err) { t.error = err; }
    w.forEach(function (f) { f(err || null, t); });
  }
  try {
    t.engine = torrentStream(magnet, {path: dir, tmp: DIR, connections: 80, uploads: 4, dht: true, tracker: true, verify: true, trackers: trackers});
  } catch (e) { current = null; cb({code: 500, message: String(e && e.message || e)}); return; }
  t.timer = setTimeout(function () {
    if (!t.ready) { finish({code: 504, message: 'no peers sent the torrent\'s file list in time'}); stop(t); }
  }, METADATA_MS);
  t.engine.on('ready', function () {
    clearTimeout(t.timer);
    t.files = fileList(t.engine);
    t.ready = true;
    log('ready', hash, t.files.length + ' files');
    finish(null);
  });
  t.engine.on('error', function (e) { log('engine error', e && e.message); if (!t.ready) { finish({code: 500, message: String(e && e.message || e)}); stop(t); } });
  ((body && body.peers) || []).forEach(function (p) { try { t.engine.connect(String(p)); } catch (e) { /* bad address */ } });
}

// the idle torrent goes away after a while
setInterval(function () { if (current && Date.now() - current.last > IDLE_MS) { log('idle: removing', current.hash); stop(current); } }, 60000);

// ---- HTTP -----------------------------------------------------------------------------------------------------------------------
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
}
function json(res, code, obj) {
  var s = JSON.stringify(obj);
  cors(res);
  res.writeHead(code, {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s)});
  res.end(s);
}
function readBody(req, cb) {
  var chunks = [], size = 0;
  req.on('data', function (c) { size += c.length; if (size < 1e6) chunks.push(c); });
  req.on('end', function () {
    var o = null;
    try { o = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { /* not JSON */ }
    cb(o || {});
  });
}
function status() {
  var t = current, e = t && t.engine, sw = e && e.swarm;
  return {ok: true, name: 'freetv-torrents', version: VERSION, node: process.version, dir: DIR,
    torrent: t ? {infoHash: t.hash, ready: t.ready, files: t.files.length, peers: sw ? sw.wires.length : 0, downloaded: sw ? sw.downloaded : 0, speed: sw && sw.downloadSpeed ? sw.downloadSpeed() : 0} : null};
}
function serve(req, res, t, idx) {
  var f = t.engine.files[idx];
  if (!f) { json(res, 404, {error: 'no such file'}); return; }
  t.last = Date.now();
  var range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || ''), start = 0, end = f.length - 1, code = 200;
  if (range && (range[1] || range[2])) {
    if (range[1]) { start = Number(range[1]); if (range[2]) end = Math.min(Number(range[2]), f.length - 1); }
    else { start = Math.max(0, f.length - Number(range[2])); }
    if (start > end || start >= f.length) { cors(res); res.writeHead(416, {'Content-Range': 'bytes */' + f.length}); res.end(); return; }
    code = 206;
  }
  var ext = (/\.([A-Za-z0-9]+)$/.exec(f.name) || [])[1];
  var head = {'Content-Type': TYPES[String(ext).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-store'};
  if (code === 206) head['Content-Range'] = 'bytes ' + start + '-' + end + '/' + f.length;
  cors(res);
  res.writeHead(code, head);
  if (req.method === 'HEAD') { res.end(); return; }
  var stream = f.createReadStream({start: start, end: end});
  stream.on('error', function () { try { res.end(); } catch (e) { /* closed */ } });
  stream.pipe(res);
  res.on('close', function () { try { stream.destroy(); } catch (e) { /* done */ } });
}
var server = http.createServer(function (req, res) {
  var pathname = String(req.url || '').split('?')[0], m;
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }
  if (pathname === '/status' || pathname === '/') { json(res, 200, status()); return; }
  m = /^\/([0-9a-fA-F]{40})\/create$/.exec(pathname);
  if (m && req.method === 'POST') {
    var hash = m[1].toLowerCase();
    readBody(req, function (body) {
      open(hash, body, function (err, t) {
        if (err) { json(res, err.code || 500, {error: err.message}); return; }
        var files = t.files, wantIdx = body && body.fileIdx;
        var idx = typeof wantIdx === 'number' ? wantIdx : guess(files);
        var f = files[idx];
        if (!f) { json(res, 404, {error: 'the torrent has no such file'}); return; }
        freeBytes(DIR, function (free) {
          if (free >= 0 && free < f.length * 1.02 + 50 * 1048576) {
            json(res, 507, {error: 'not enough free space on the TV (' + Math.round(free / 1048576) + ' MB free, ' + Math.round(f.length / 1048576) + ' MB needed)', free: free, needed: f.length});
            return;
          }
          json(res, 200, {infoHash: hash, files: files, guessedFileIdx: idx});
        });
      });
    });
    return;
  }
  m = /^\/([0-9a-fA-F]{40})\/(\d+)$/.exec(pathname);
  if (m && (req.method === 'GET' || req.method === 'HEAD')) {
    var h = m[1].toLowerCase();
    if (!current || current.hash !== h || !current.ready) { json(res, 404, {error: 'torrent not created: POST /' + h + '/create first'}); return; }
    serve(req, res, current, Number(m[2]));
    return;
  }
  json(res, 404, {error: 'not found'});
});
server.on('error', function (e) { log('server error', e && e.code || e); });
server.listen(PORT, HOST, function () { log('listening on ' + HOST + ':' + PORT + ', data in ' + DIR + ', node ' + process.version); });

if (DIR) { try { fs.readdirSync(DIR).forEach(function (n) { rmrf(path.join(DIR, n)); }); } catch (e) { /* nothing from before */ } }
module.exports = {server: server, status: status};
