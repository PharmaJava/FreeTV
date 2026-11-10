'use strict';
/*
 * The Luna service the FreeTV screen talks to (luna://com.gathin.tvhome.store/...): status, install, job.
 * The logic is in store.js. The Developer Mode SSH key is the file state/key.pem, put there once by tools/provision_store.js
 * when FreeTV is installed from the computer (the page cannot write it: this service has no method for that).
 */
var fs = require('fs'), path = require('path'), Service = require('webos-service');
// Loaded when a method needs them (the SSH library is most of this service's memory: sysinfo, which FreeTV's RAM line calls every
// few seconds, must not pay for it).
var Store = function (options) { return new (require('./store').Store)(options); };
var youtube = { search: function (q, done) { require('./youtube').search(q, done); } };

var service = new Service('com.gathin.tvhome.store');
var dir = path.join(__dirname, 'state'), keyFile = path.join(dir, 'key.pem');
var store = null;

function readKey() {
  try { return fs.readFileSync(keyFile, 'utf8'); } catch (e) { return ''; }
}

function current() {
  var key = readKey();
  if (!key) { store = null; return null; }
  if (!store || store.key !== key) {
    store = Store({key: key, log: function (m) { console.log(m); }});
    store.hardenState();   // key.pem back to 640 (a reinstall makes it readable by every app)
  }
  store.github = readJson(path.join(dir, 'github-repos.json'), []).filter(function (x) { return typeof x === 'string'; });
  return store;
}

service.register('status', function (message) {
  var s = current();
  if (!s) { message.respond({returnValue: true, provisioned: false, ready: false, job: null}); return; }
  s.check().then(function (r) {
    message.respond({returnValue: true, provisioned: true, ready: r.ok, error: r.error || '', job: s.job});
  });
});

service.register('install', function (message) {
  var s = current(), p = message.payload || {};
  if (!s) { message.respond({returnValue: false, error: 'FreeTV todavía no tiene permiso para instalar desde la tele: vuelve a ejecutar bash install.sh en el ordenador.'}); return; }
  var r = s.start(String(p.id || ''), String(p.flag || ''), p.update === true);
  message.respond(r.ok ? {returnValue: true} : {returnValue: false, error: r.error});
});

/**
 * GitHub projects as catalogue entries. githubApps: the ones FreeTV brings and the person's. githubAdd {repo}: a link or owner/repo; it is
 * resolved first (it must have an .ipk and its SHA-256 in its latest release) and only then kept. githubRemove {repo}.
 */
var GH_FILE = path.join(dir, 'github-repos.json');
service.register('githubApps', function (message) {
  var s = current();
  if (!s) { message.respond({returnValue: false, error: 'sin permiso'}); return; }
  s.connect().then(function (conn) {
    return s.githubPackages(conn).then(function (list) {
      try { conn.end(); } catch (e) {}
      message.respond({returnValue: true, packages: list, mine: s.github, defaults: require('./store').GITHUB_DEFAULT});
    });
  }).catch(function (e) { message.respond({returnValue: false, error: String(e && e.message || e)}); });
});
service.register('githubAdd', function (message) {
  var s = current(), St = require('./store'), repo = St.githubRepo((message.payload || {}).repo);
  if (!s) { message.respond({returnValue: false, error: 'sin permiso'}); return; }
  if (!repo) { message.respond({returnValue: false, error: 'Eso no parece un enlace de GitHub (https://github.com/usuario/proyecto).'}); return; }
  s.connect().then(function (conn) {
    return s.githubPackage(conn, repo).then(function (pkg) {
      try { conn.end(); } catch (e) {}
      var mine = s.github.filter(function (x) { return x !== repo; });
      if (St.GITHUB_DEFAULT.indexOf(repo) < 0) mine.push(repo);
      writeJson(GH_FILE, mine.slice(-12));
      message.respond({returnValue: true, package: pkg});
    }, function (e) { try { conn.end(); } catch (x) {} message.respond({returnValue: false, error: String(e && e.message || e)}); });
  }).catch(function (e) { message.respond({returnValue: false, error: String(e && e.message || e)}); });
});
service.register('githubRemove', function (message) {
  var s = current(), repo = require('./store').githubRepo((message.payload || {}).repo);
  if (!s || !repo) { message.respond({returnValue: false, error: 'no'}); return; }
  writeJson(GH_FILE, s.github.filter(function (x) { return x !== repo; }));
  message.respond({returnValue: true});
});

/** Which installed apps have a newer version in the catalogue: {updates: [{id, title, from, to, flag}], installed: {id: version}}. */
service.register('updates', function (message) {
  var s = current();
  if (!s) { message.respond({returnValue: false, error: 'sin permiso'}); return; }
  s.connect().then(function (conn) {
    return s.updates(conn).then(function (r) { try { conn.end(); } catch (e) {} message.respond({returnValue: true, updates: r.list, installed: r.installed, sizes: r.sizes, freeMb: r.freeMb}); },
      function (e) { try { conn.end(); } catch (x) {} message.respond({returnValue: false, error: String(e && e.message || e)}); });
  }, function (e) { message.respond({returnValue: false, error: String(e && e.message || e)}); });
});

/** Updates every installed app that has a newer version (not the ones that need a confirmation). Progress: `job`, field batch. */
service.register('updateAll', function (message) {
  var s = current();
  if (!s) { message.respond({returnValue: false, error: 'FreeTV todavía no tiene permiso para instalar desde la tele: vuelve a ejecutar bash install.sh en el ordenador.'}); return; }
  var r = s.startUpdateAll();
  message.respond(r.ok ? {returnValue: true} : {returnValue: false, error: r.error});
});

/** The apps installed through Developer Mode, for FreeTV to list the new ones at once. */
service.register('apps', function (message) {
  var s = current();
  if (!s) { message.respond({returnValue: false, error: 'sin permiso'}); return; }
  s.connect().then(function (conn) {
    return s.devApps(conn).then(function (apps) { try { conn.end(); } catch (e) {} message.respond(apps ? {returnValue: true, apps: apps} : {returnValue: false, error: 'sin lista'}); },
      function (e) { try { conn.end(); } catch (x) {} message.respond({returnValue: false, error: String(e && e.message || e)}); });
  }, function (e) { message.respond({returnValue: false, error: String(e && e.message || e)}); });
});

/** Uninstalls an app (Developer Mode can only remove what it installed: for the others the answer says so, code 'not-removable'). */
service.register('remove', function (message) {
  var s = current(), p = message.payload || {};
  if (!s) { message.respond({returnValue: false, code: 'no-key', error: 'FreeTV todavía no tiene permiso para borrar desde la tele: vuelve a ejecutar bash install.sh en el ordenador.'}); return; }
  s.remove(String(p.id || '')).then(function (r) {
    message.respond(r.ok ? {returnValue: true} : {returnValue: false, code: r.code || 'failed', error: r.error});
  });
});

/** YouTube channels for FreeTV's Custom tab: a name, an @name or a youtube.com address (the screen cannot read YouTube itself). */
service.register('channels', function (message) {
  youtube.search((message.payload || {}).query, function (err, list) {
    message.respond(err ? {returnValue: false, error: String(err.message || err)} : {returnValue: true, channels: list});
  });
});

/**
 * The Developer Mode session. {below: hours}: extend only when less is left (default 336 = 14 days; 0 only looks; 100000 always extends).
 * Keeps a short history in state/devmode.json (when, hours left, what was done), never the token.
 */
var HISTORY = path.join(dir, 'devmode.json');
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; } }
function writeJson(file, value) {
  try { fs.writeFileSync(file + '.tmp', JSON.stringify(value)); fs.chmodSync(file + '.tmp', 0o640); fs.renameSync(file + '.tmp', file); return true; } catch (e) { return false; }
}

service.register('devmode', function (message) {
  var s = current(), p = message.payload || {}, below = p.below === undefined ? 336 : Math.max(0, Number(p.below) || 0);
  var history = readJson(HISTORY, []);
  if (!s) { message.respond({returnValue: false, error: 'sin permiso', history: history}); return; }
  s.devmodeTick(below).then(function (r) {
    var last = history[history.length - 1];
    var entry = {at: Date.now(), ok: r.ok, hours: r.after !== undefined ? r.after : r.before, extended: !!r.extended, error: r.error || ''};
    if (r.extended || !r.ok || !last || entry.at - last.at > 6 * 3600 * 1000) { history.push(entry); history = history.slice(-30); writeJson(HISTORY, history); }
    message.respond({returnValue: true, ok: r.ok, hours: entry.hours, extended: !!r.extended, error: r.error || '', history: history});
  });
});

/** The settings the person chose (and the keys of the TV's remote API) survive a reinstall of FreeTV: the page keeps a copy here. */
var PREFS = path.join(dir, 'prefs.json');
var PREF_KEYS = /^fmtv\.(prefs|devApps|ssapKey|ssapPowerKey2|ssapRefused|ssapPowerRefused|usage|cfg)$/;
service.register('prefsSave', function (message) {
  var data = (message.payload || {}).data, clean = {}, k;
  if (!data || typeof data !== 'object') { message.respond({returnValue: false, error: 'sin datos'}); return; }
  for (k in data) if (Object.prototype.hasOwnProperty.call(data, k) && PREF_KEYS.test(k) && typeof data[k] === 'string' && data[k].length < 200000) clean[k] = data[k];
  message.respond(writeJson(PREFS, clean) ? {returnValue: true} : {returnValue: false, error: 'no se pudo escribir'});
});
service.register('prefsLoad', function (message) {
  message.respond({returnValue: true, data: readJson(PREFS, null)});
});

/**
 * Companion: starts store-service/companion.js apart from this service (it ends by itself) and says where the phone must go.
 * Started through the TV's own SSH like the other jobs, so it lives and dies on its own and this service can exit as usual.
 */
service.register('companionStart', function (message) {
  var s = current(), crypto = require('crypto'), os = require('os');
  if (!s) { message.respond({returnValue: false, error: 'sin permiso'}); return; }
  var token = crypto.randomBytes(6).toString('hex'), ip = '', nets = os.networkInterfaces();
  Object.keys(nets).forEach(function (n) { (nets[n] || []).forEach(function (a) { if (!ip && a.family === 'IPv4' && !a.internal) ip = a.address; }); });
  var log = '/media/developer/temp/fmtv-companion.log', file = path.join(__dirname, 'companion.js');
  s.connect().then(function (conn) {
    var cmd = '/usr/bin/curl -s -m 2 http://127.0.0.1:8089/bye >/dev/null 2>&1; /bin/mkdir -p /media/developer/temp; rm -f ' + log + '; ' +
      'nohup node \'' + file + '\' ' + token + ' 600 > ' + log + ' 2>&1 < /dev/null & sleep 2; cat ' + log;
    return s.exec(conn, cmd).then(function (r) {
      try { conn.end(); } catch (e) {}
      var port = /listening (\d+)/.exec(r.out || '');
      if (!port || !ip) { message.respond({returnValue: false, error: 'no arrancó'}); return; }
      message.respond({returnValue: true, ip: ip, port: +port[1], token: token});
    });
  }).catch(function (e) { message.respond({returnValue: false, error: String(e && e.message || e)}); });
});

/**
 * Looks (read only, names and permissions, never contents) for where an app keeps its data on the TV, and whether this service's shell may read it.
 * It answers a question: can FreeTV see what a web app played (Stremio Origin's library) without the person's account? {id}: an app id.
 */
service.register('appDataProbe', function (message) {
  var id = String((message.payload || {}).id || '');
  var s = current();
  if (!/^[a-z0-9][a-z0-9.\-]{2,60}$/.test(id)) { message.respond({returnValue: false, error: 'id no válido'}); return; }
  if (!s) { message.respond({returnValue: false, error: 'sin permiso'}); return; }
  var cmd = '(timeout -t 25 find / -maxdepth 9 -path "*' + id + '*" 2>/dev/null | head -60; ' +
    'timeout -t 25 find / -maxdepth 7 \\( -iname "*localstorage*" -o -iname "*leveldb*" -o -iname "*IndexedDB*" \\) 2>/dev/null | head -30) | ' +
    'while read f; do if [ -r "$f" ]; then r=read; else r=NO; fi; echo "$r $(ls -ld "$f" 2>/dev/null | cut -c1-90)"; done';
  s.connect().then(function (conn) {
    return s.exec(conn, cmd).then(function (r) {
      try { conn.end(); } catch (e) {}
      var lines = String(r.out || '').split('\n').filter(function (l) { return l; }).slice(0, 90).map(function (l) { return l.slice(0, 170); });
      message.respond({returnValue: true, id: id, lines: lines});
    });
  }).catch(function (e) { message.respond({returnValue: false, error: String(e && e.message || e)}); });
});

/** The report FreeTV's Diagnostics sheet makes (no keys, no names): kept on the TV with this service's own facts, to read or to attach to an issue. */
service.register('diagSave', function (message) {
  var text = String((message.payload || {}).text || '').slice(0, 30000), extra = [];
  extra.push('service: node ' + process.version + ', up ' + Math.round(process.uptime()) + ' s, pid ' + process.pid);
  try { extra.push('state files: ' + fs.readdirSync(dir).filter(function (f) { return !/key|pem/i.test(f); }).join(', ')); } catch (e) {}
  try { extra.push('uptime of the TV: ' + fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0] + ' s'); } catch (e) {}
  try { extra.push('kernel: ' + fs.readFileSync('/proc/version', 'utf8').split(' ').slice(0, 3).join(' ')); } catch (e) {}
  var ok = false;
  try { fs.writeFileSync(path.join(dir, 'diagnostics.txt'), text + '\n' + extra.join('\n') + '\n'); ok = true; } catch (e) {}
  message.respond(ok ? {returnValue: true, extra: extra} : {returnValue: false, error: 'no se pudo escribir'});
});

/**
 * A news feed for FreeTV's News widget: the screen cannot read RSS (no CORS), the TV's service can. {url}: an https address;
 * the answer is its text, up to 1 MB. Only GET, only https, nothing kept.
 */
function fetchText(url, done, hops) {
  var u = require('url').parse(String(url || ''));
  if (u.protocol !== 'https:' || !u.hostname) { done(new Error('solo https')); return; }
  u.headers = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) FreeTV', 'Accept': 'application/rss+xml, application/xml, text/xml, */*'};
  var req = require('https').get(u, function (res) {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (hops || 0) < 4) {
      res.resume();
      fetchText(require('url').resolve(url, res.headers.location), done, (hops || 0) + 1);
      return;
    }
    if (res.statusCode !== 200) { res.resume(); done(new Error('HTTP ' + res.statusCode)); return; }
    var parts = [], size = 0;
    res.on('data', function (d) { size += d.length; if (size <= 1024 * 1024) parts.push(d); else req.abort(); });
    res.on('end', function () { done(null, Buffer.concat(parts).toString('utf8')); });
  });
  req.on('error', done);
  req.setTimeout(15000, function () { req.abort(); });
}
service.register('feed', function (message) {
  fetchText((message.payload || {}).url, function (err, text) {
    message.respond(err ? {returnValue: false, error: String(err.message || err)} : {returnValue: true, text: text});
  });
});

/** FreeTV's own releases: is there a newer one than {have}? The answer is what the release says, never anything the page sends. */
var lastRelease = null;
service.register('updateCheck', function (message) {
  var u = require('./update'), have = String((message.payload || {}).have || '');
  u.latest(u.repo(dir), function (err, d) {
    if (err) { message.respond({returnValue: false, error: String(err.message || err)}); return; }
    lastRelease = d;
    message.respond({returnValue: true, repo: u.repo(dir), version: d.version, notes: d.notes, size: d.size, at: d.at, newer: !have || u.isNewer(d.version, have)});
  });
});

/** Installs the release updateCheck found (and only that one), once the person said yes (or chose automatic) on the TV. */
service.register('updateInstall', function (message) {
  var s = current(), u = require('./update'), want = String((message.payload || {}).version || '');
  if (!s) { message.respond({returnValue: false, error: 'FreeTV todavía no tiene permiso para instalar desde la tele: vuelve a ejecutar bash install.sh en el ordenador.'}); return; }
  // Asked again here: this service exits when idle, so what updateCheck found is gone by the time the person says yes.
  u.latest(u.repo(dir), function (err, d) {
    if (err || !d || d.version !== want) { message.respond({returnValue: false, error: 'La versión ha cambiado: busca de nuevo.'}); return; }
    var r = s.startSelfUpdate(d);
    message.respond(r.ok ? {returnValue: true} : {returnValue: false, error: r.error});
  });
});

/** The TV's memory (MB) and load, for FreeTV's RAM line: read from /proc, nothing else. */
service.register('sysinfo', function (message) {
  try {
    var m = fs.readFileSync('/proc/meminfo', 'utf8');
    var kb = function (key) { var r = new RegExp('^' + key + ':\\s+(\\d+)', 'm').exec(m); return r ? Math.round(r[1] / 1024) : 0; };
    var out = {returnValue: true, total: kb('MemTotal'), avail: kb('MemAvailable'), swapTotal: kb('SwapTotal'), swapFree: kb('SwapFree'),
      load: parseFloat(fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]) || 0};
    out.cma = kb('CmaTotal');   // memory the TV keeps for graphics and video: fixed
    if ((message.payload || {}).procs) {   // MB held by each app that names itself ("appId":"netflix"), and every process over 6 MB
      out.apps = {};
      out.top = [];
      fs.readdirSync('/proc').forEach(function (pid) {
        if (!/^\d+$/.test(pid)) return;
        try {
          var st = fs.readFileSync('/proc/' + pid + '/status', 'utf8'), rss = /VmRSS:\s+(\d+)/.exec(st);
          if (!rss) return;
          var mb = Math.round(rss[1] / 1024), cmd = fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8');
          var id = /"appId":"([^"]+)"/.exec(cmd), name = '?';
          try { name = fs.readFileSync('/proc/' + pid + '/comm', 'utf8').trim() || '?'; } catch (e2) {}
          if (id) out.apps[id[1]] = (out.apps[id[1]] || 0) + mb;
          if (mb >= 6) {
            var kind = /--type=renderer/.test(cmd) ? 'renderer' : /--type=/.test(cmd) ? 'helper' : '';
            out.top.push({n: name, mb: mb, app: id ? id[1] : '', kind: kind});
          }
        } catch (e) {}
      });
      out.top.sort(function (a, b) { return b.mb - a.mb; });
      out.top = out.top.slice(0, 40);
    }
    message.respond(out);
  } catch (e) { message.respond({returnValue: false, error: String(e && e.message || e)}); }
});

/** LG's ACR state (see store.js privacy). */
service.register('privacy', function (message) {
  var s = current();
  if (!s) { message.respond({returnValue: false, error: 'sin permiso'}); return; }
  s.connect().then(function (conn) {
    return s.privacy(conn).then(function (r) { try { conn.end(); } catch (e) {} message.respond({returnValue: true, privacy: r}); },
      function (e) { try { conn.end(); } catch (x) {} message.respond({returnValue: false, error: String(e && e.message || e)}); });
  }, function (e) { message.respond({returnValue: false, error: String(e && e.message || e)}); });
});

service.register('job', function (message) {
  var s = current();
  message.respond({returnValue: true, job: s ? s.job : null});
});
