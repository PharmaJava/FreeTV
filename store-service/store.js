'use strict';
/*
 * FreeTV's store, TV side: installs a community app from the webOS Homebrew catalogue without the person's computer.
 *
 * Why it works this way. An app or a service on the TV is not allowed to call LG's installer (com.webos.appInstallService
 * answers "Denied method call" for /dev/install and for install). A Developer Mode SSH session is: that is what the
 * computer's `ares-install` uses. The TV's own Developer Mode SSH server is reachable from the TV itself (127.0.0.1:9922),
 * so this opens a session to it, the same way `ares-install` does, and runs the same commands there:
 *   1. the TV's own curl reads the catalogue and downloads the package (the TV's certificates, no TLS in this old Node),
 *   2. sha256sum checks the package against the hash the catalogue publishes (no hash, or a different one: nothing is installed),
 *   3. luna-send-pub calls /dev/install, then the app list is read to see that it really is there.
 * The key for that SSH session is put here once, when FreeTV is installed from the computer (tools/provision_store.py).
 *
 * What it refuses: apps that need root; an id that is not in the catalogue; a package without hash; a hash that does not
 * match; apps with a warning unless the person confirmed it on the TV (the flag); more than one install at a time.
 * Plain ES2015 and async functions: the TV runs Node 8.12.
 */
var Client = require('ssh2').Client;

var CATALOGUE = 'https://repo.webosbrew.org/api/apps.json';
// Other people's repositories FreeTV also reads, each one only for the app ids listed (nothing else in them is offered).
// What comes from here always needs the person's "unofficial" confirmation; root, https and the SHA-256 hash are checked the same.
var EXTRA = [{url: 'https://atlet99.github.io/rezkatv-public/repository.json', ids: ['com.rezkatv.app', 'com.rezkatv.app.legacy']}];
var TEMP = '/media/developer/temp';
var ID_RE = /^[A-Za-z0-9._-]{1,80}$/;
var URL_RE = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{2,5})?\/[A-Za-z0-9._~!$&()*+,;=:@%\/?#-]*$/;   // no quotes, no spaces: it goes into a shell command
var SHA_RE = /^[0-9a-f]{64}$/;
var MAX_PACKAGE = 400 * 1024 * 1024;

// The flag each cautioned app needs (kept in step with tools/community.py CAUTION and home/home.js COMM_FLAG).
var CAUTION = {
  'youtube.leanback.v4': 'official-removed',
  'com.open.hidden.menu': 'sensitive',
  'com.pirate.refresh': 'sensitive',
  'org.webosbrew.hbchannel': 'sensitive',
  'com.rezkatv.app': 'unofficial',
  'com.rezkatv.app.legacy': 'unofficial'
};

function Store(options) {
  this.host = options.host || '127.0.0.1';
  this.port = options.port || 9922;
  this.user = options.user || 'prisoner';
  this.key = options.key;             // the private key (PEM text) of the Developer Mode SSH session
  this.passphrase = options.passphrase || undefined;
  this.log = options.log || function () {};
  this.job = {phase: 'idle', id: '', title: '', message: '', note: '', at: 0};
  this.busy = false;
}

Store.prototype.set = function (fields) {
  for (var k in fields) if (Object.prototype.hasOwnProperty.call(fields, k)) this.job[k] = fields[k];
  this.job.at = Date.now();
};

Store.prototype.connect = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    var conn = new Client(), settled = false;
    conn.on('ready', function () { settled = true; resolve(conn); });
    conn.on('error', function (e) { if (!settled) { settled = true; reject(e); } });
    try {
      conn.connect({host: self.host, port: self.port, username: self.user, privateKey: self.key, passphrase: self.passphrase, readyTimeout: 15000});
    } catch (e) { settled = true; reject(e); }
  });
};

/** Runs one command in the SSH session. onData(text) sees the output as it comes; returning true from it ends the command early. */
Store.prototype.exec = function (conn, command, onData) {
  return new Promise(function (resolve, reject) {
    conn.exec(command, function (err, stream) {
      if (err) { reject(err); return; }
      var out = '', errText = '', finished = false;
      function done(code) { if (!finished) { finished = true; resolve({code: code, out: out, err: errText}); } }
      stream.on('data', function (d) {
        var text = d.toString();
        out += text;
        if (out.length > 2000000) out = out.slice(-1000000);
        if (onData && onData(text, out) === true) { try { stream.end(); } catch (e) {} done(0); }
      });
      stream.stderr.on('data', function (d) { errText += d.toString(); if (errText.length > 20000) errText = errText.slice(-10000); });
      stream.on('close', function (code) { done(code === undefined || code === null ? 0 : code); });
    });
  });
};

function fail(message) { var e = new Error(message); e.fatal = true; return e; }

/** Single quotes around a value that was already checked to hold none. */
function q(value) {
  if (/['\\\n\r`]/.test(value)) throw fail('Valor no válido.');
  return "'" + value + "'";
}

Store.prototype.catalogue = async function (conn) {
  var r = await this.exec(conn, 'curl -fsSL --connect-timeout 20 --max-time 60 ' + q(CATALOGUE));
  if (r.code !== 0) throw fail('No pude leer el catálogo (' + (r.err.trim().split('\n').pop() || 'sin respuesta') + ').');
  var apps;
  try { apps = JSON.parse(r.out).packages; } catch (e) { throw fail('El catálogo no tiene el formato esperado.'); }
  for (var x = 0; x < EXTRA.length; x++) {
    var e = await this.exec(conn, 'curl -fsSL --connect-timeout 20 --max-time 60 ' + q(EXTRA[x].url));
    if (e.code !== 0) continue;   // an extra source that does not answer is just not offered
    var more;
    try { more = JSON.parse(e.out).packages; } catch (err) { continue; }
    for (var y = 0; y < more.length; y++) {
      var id = more[y] && more[y].id;
      if (EXTRA[x].ids.indexOf(id) >= 0 && !apps.some(function (a) { return a.id === id; })) apps.push(more[y]);
    }
  }
  return apps;
};

Store.prototype.freeMb = async function (conn) {
  var r = await this.exec(conn, 'df -m /media/developer | tail -1');
  var f = r.out.trim().split(/\s+/);
  var n = parseInt(f[3], 10);
  return isNaN(n) ? null : n;
};

Store.prototype.installedIds = async function (conn) {
  var r = await this.exec(conn, "luna-send-pub -n 1 luna://com.webos.applicationManager/dev/listApps '{}'");
  try { return JSON.parse(r.out.trim().split('\n')[0]).apps.map(function (a) { return a.id; }); } catch (e) { return null; }
};

/** The apps installed through Developer Mode: [{id, title, icon (a file:// address), color}], without FreeTV's own pieces. */
Store.prototype.devApps = async function (conn) {
  var r = await this.exec(conn, "timeout -t 20 luna-send-pub -n 1 luna://com.webos.applicationManager/dev/listApps '{}'");
  var apps;
  try { apps = JSON.parse(r.out.trim().split('\n')[0]).apps; } catch (e) { return null; }
  return apps.filter(function (a) { return a.id && !/^com\.gathin\.tvhome/.test(a.id) && a.id !== 'com.local.nativehome'; }).map(function (a) {
    var icon = a.largeIcon || a.icon || '';
    return {id: a.id, title: a.title || a.id, icon: icon && a.folderPath && !/\.\./.test(icon) ? 'file://' + a.folderPath + '/' + icon : '', color: a.iconColor || a.bgColor || ''};
  });
};

/** The whole install. Resolves when done or failed (the outcome is in this.job). */
Store.prototype.run = async function (appId, flag) {
  var self = this, conn = null, file = '';
  try {
    if (!ID_RE.test(appId)) throw fail('Identificador no válido.');
    conn = await this.connect();
    this.set({phase: 'starting', id: appId, title: '', message: '', note: ''});
    var apps = await this.catalogue(conn), app = null, i;
    for (i = 0; i < apps.length; i++) if (apps[i].id === appId) app = apps[i];
    if (!app) throw fail('«' + appId + '» no está en el catálogo.');
    var m = app.manifest || {}, hash = ((m.ipkHash || {}).sha256 || '').toLowerCase();
    this.set({title: app.title || appId});
    if (m.rootRequired) throw fail('Esta app necesita una tele con root: FreeTV no la instala.');
    if (CAUTION[appId] && CAUTION[appId] !== flag) throw fail('Esta app necesita que confirmes su aviso en la tele.');
    if (!SHA_RE.test(hash)) throw fail('El catálogo no publica el hash SHA-256 de este paquete: no lo instalo sin poder comprobarlo.');
    if (typeof m.ipkUrl !== 'string' || !URL_RE.test(m.ipkUrl)) throw fail('La dirección del paquete no es una dirección https válida.');
    var sizeMb = (m.ipkSize || 0) / 1048576, free = await this.freeMb(conn);
    if (free !== null && sizeMb && free < sizeMb * 2.2) {
      this.set({note: 'Ocupa unos ' + Math.round(sizeMb) + ' MB y quedan ' + free + ' MB libres: quizá no quepa. Si falla, borra apps que no uses en la tele.'});
    }
    file = TEMP + '/freetv-' + appId.replace(/[^A-Za-z0-9._-]/g, '_') + '.ipk';
    await this.exec(conn, '/bin/mkdir -p ' + TEMP + ' && /bin/chmod 777 ' + TEMP);

    this.set({phase: 'downloading'});
    var limit = Math.min(MAX_PACKAGE, Math.max(8 * 1048576, Math.round((m.ipkSize || 0) * 1.25) || MAX_PACKAGE));
    var d = await this.exec(conn, '/bin/rm -f ' + q(file) + '; curl -fsSL --connect-timeout 20 --max-time 1800 --max-filesize ' + limit + ' -o ' + q(file) + ' ' + q(m.ipkUrl));
    if (d.code !== 0) throw fail('No pude descargar el paquete (' + (d.err.trim().split('\n').pop() || 'código ' + d.code) + ').');

    this.set({phase: 'verifying'});
    var h = await this.exec(conn, 'sha256sum ' + q(file));
    var got = (h.out.trim().split(/\s+/)[0] || '').toLowerCase();
    if (got !== hash) throw fail('El hash NO coincide con el del catálogo: lo he borrado y no instalo nada.');

    this.set({phase: 'installing'});
    var payload = JSON.stringify({id: appId, ipkUrl: file, subscribe: true}), state = '', bad = '', lines = '';
    // (the TV's BusyBox is old: `timeout -t SECONDS command`)
    await this.exec(conn, 'timeout -t 600 luna-send-pub -i luna://com.webos.appInstallService/dev/install ' + q(payload), function (text) {
      lines += text;
      var parts = lines.split('\n');
      lines = parts.pop();
      for (var k = 0; k < parts.length; k++) {
        var obj = null;
        try { obj = JSON.parse(parts[k]); } catch (e) { continue; }
        var s = obj && obj.details && obj.details.state ? String(obj.details.state) : '';
        if (/FAILED/i.test(s)) { bad = (obj.details && obj.details.reason) || s; return true; }
        if (/installed|^SUCCESS/i.test(s)) { state = s; return true; }
        if (obj && obj.returnValue === false) { bad = obj.errorText || 'la tele rechazó la instalación'; return true; }
      }
      return false;
    });
    await this.exec(conn, '/bin/rm -f ' + q(file));
    file = '';
    if (!state) throw fail('La tele no pudo instalarla: ' + (bad || 'sin respuesta') + (/space/i.test(bad) ? ' Libera espacio borrando apps que no uses en la tele.' : ''));
    await this.exec(conn, '/usr/sbin/ls-control scan-services');

    // «Success» has been said for installs that did not happen (YouTube AdFree over the official one): look for the app.
    var ids = await this.installedIds(conn);
    if (ids && ids.indexOf(appId) < 0) {
      throw fail('La tele dijo que sí, pero «' + appId + '» no aparece entre sus apps. Si sustituye a una de LG, borra la original en la tele y vuelve a probar.');
    }
    this.set({phase: 'done', message: ''});
  } catch (e) {
    this.set({phase: 'failed', message: e && e.fatal ? e.message : 'No se pudo instalar: ' + (e && e.message ? e.message : e)});
    this.log('install failed: ' + this.job.message);
  } finally {
    if (conn) {
      try { if (file) await this.exec(conn, '/bin/rm -f ' + q(file)); } catch (e) {}
      try { conn.end(); } catch (e) {}
    }
    this.busy = false;
  }
};

var PROTECTED = /^(com\.gathin\.|com\.local\.nativehome$|freetv\.store$)/;   // FreeTV's own pieces are never removed from here

/**
 * Uninstalls an app, as `ares-install -r` does (/dev/remove). The TV only lets Developer Mode remove what was installed through
 * Developer Mode: for an LG or store app it answers FAILED_REMOVE, and that is reported as code 'not-removable', not hidden.
 * Resolves to {ok:true} or {ok:false, error, code}.
 */
Store.prototype.remove = async function (appId) {
  var conn = null;
  if (!ID_RE.test(appId || '')) return {ok: false, error: 'Identificador no válido.'};
  if (PROTECTED.test(appId)) return {ok: false, error: 'FreeTV no se borra a sí misma desde aquí.', code: 'protected'};
  if (this.busy) return {ok: false, error: 'Hay una instalación en marcha: espera a que acabe.'};
  this.busy = true;
  try {
    conn = await this.connect();
    var payload = JSON.stringify({id: appId, subscribe: true}), state = '', bad = '', lines = '';
    await this.exec(conn, 'timeout -t 120 luna-send-pub -i luna://com.webos.appInstallService/dev/remove ' + q(payload), function (text) {
      lines += text;
      var parts = lines.split('\n');
      lines = parts.pop();
      for (var k = 0; k < parts.length; k++) {
        var obj = null;
        try { obj = JSON.parse(parts[k]); } catch (e) { continue; }
        var s = obj && obj.details && obj.details.state ? String(obj.details.state) : '';
        if (/FAILED/i.test(s)) { bad = (obj.details && obj.details.reason) || s; return true; }
        if (/removed|^SUCCESS/i.test(s)) { state = s; return true; }
        if (obj && obj.returnValue === false) { bad = obj.errorText || 'la tele rechazó el borrado'; return true; }
      }
      return false;
    });
    if (!state) {
      this.log('remove ' + appId + ' failed: ' + (bad || 'no answer'));
      return {ok: false, code: /FAILED_REMOVE|not.*(found|installed)|denied/i.test(bad) ? 'not-removable' : 'failed', error: bad || 'sin respuesta'};
    }
    var ids = await this.installedIds(conn);
    if (ids && ids.indexOf(appId) >= 0) return {ok: false, code: 'failed', error: 'La tele dijo que la había borrado, pero sigue instalada.'};
    return {ok: true};
  } catch (e) {
    return {ok: false, code: 'failed', error: String(e && e.message || e)};
  } finally {
    if (conn) { try { conn.end(); } catch (e) {} }
    this.busy = false;
  }
};

/** Starts an install; returns {ok:true} or {ok:false, error}. */
Store.prototype.start = function (appId, flag) {
  if (!ID_RE.test(appId || '')) return {ok: false, error: 'Identificador no válido.'};
  if (this.busy) return {ok: false, error: 'Ya hay una instalación en marcha.'};
  this.busy = true;
  this.set({phase: 'starting', id: appId, title: '', message: '', note: ''});
  this.run(appId, flag || '');
  return {ok: true};
};

/** Can the SSH session be opened? (what the screen asks before it offers the Install button) */
Store.prototype.check = async function () {
  var conn = null;
  try {
    conn = await this.connect();
    var r = await this.exec(conn, 'echo freetv-ok');
    return r.out.indexOf('freetv-ok') >= 0 ? {ok: true} : {ok: false, error: 'La tele no respondió como se esperaba.'};
  } catch (e) {
    return {ok: false, error: String(e && e.message || e)};
  } finally {
    if (conn) { try { conn.end(); } catch (e) {} }
  }
};

module.exports = {Store: Store, CAUTION: CAUTION, PROTECTED: PROTECTED};
