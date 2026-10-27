'use strict';
/*
 * The Luna service the FreeTV screen talks to (luna://com.gathin.tvhome.store/...): status, install, job.
 * The logic is in store.js. The Developer Mode SSH key is the file state/key.pem, put there once by tools/provision_store.js
 * when FreeTV is installed from the computer (the page cannot write it: this service has no method for that).
 */
var fs = require('fs'), path = require('path'), Service = require('webos-service');
var Store = require('./store').Store;
var youtube = require('./youtube');

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
    store = new Store({key: key, log: function (m) { console.log(m); }});
    store.hardenState();   // key.pem back to 640 (a reinstall makes it readable by every app)
  }
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
var PREF_KEYS = /^fmtv\.(prefs|devApps|ssapKey|ssapPowerKey2|ssapRefused|ssapPowerRefused)$/;
service.register('prefsSave', function (message) {
  var data = (message.payload || {}).data, clean = {}, k;
  if (!data || typeof data !== 'object') { message.respond({returnValue: false, error: 'sin datos'}); return; }
  for (k in data) if (Object.prototype.hasOwnProperty.call(data, k) && PREF_KEYS.test(k) && typeof data[k] === 'string' && data[k].length < 200000) clean[k] = data[k];
  message.respond(writeJson(PREFS, clean) ? {returnValue: true} : {returnValue: false, error: 'no se pudo escribir'});
});
service.register('prefsLoad', function (message) {
  message.respond({returnValue: true, data: readJson(PREFS, null)});
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
