'use strict';
/*
 * The Luna service the FreeTV screen talks to (luna://com.gathin.tvhome.store/...): status, install, job.
 * The logic is in store.js. The Developer Mode SSH key is the file state/key.pem, put there once by tools/provision_store.js
 * when FreeTV is installed from the computer (the page cannot write it: this service has no method for that).
 */
var fs = require('fs'), path = require('path'), Service = require('webos-service');
var Store = require('./store').Store;

var service = new Service('com.gathin.tvhome.store');
var dir = path.join(__dirname, 'state'), keyFile = path.join(dir, 'key.pem');
var store = null;

function readKey() {
  try { return fs.readFileSync(keyFile, 'utf8'); } catch (e) { return ''; }
}

function current() {
  var key = readKey();
  if (!key) { store = null; return null; }
  if (!store || store.key !== key) store = new Store({key: key, log: function (m) { console.log(m); }});
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
  var r = s.start(String(p.id || ''), String(p.flag || ''));
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

service.register('job', function (message) {
  var s = current();
  message.respond({returnValue: true, job: s ? s.job : null});
});
