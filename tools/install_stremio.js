#!/usr/bin/env node
'use strict';
/*
 * Stremio Claude (our Stremio Origin, github.com/PharmaJava/webos) installed with FreeTV: run by install.sh after FreeTV.
 *
 *   node tools/install_stremio.js <TV IP>
 *
 * The same installer the TV's Store uses (store-service/store.js): the newest release of PharmaJava/webos, downloaded by the TV,
 * checked against the SHA-256 the release publishes, installed through Developer Mode. It uses the Developer Mode key `ares`
 * already has for this TV (the passphrase stays on this computer). Already installed: it is left as it is (the Store updates it).
 */
var path = require('path');
var Store = require(path.join(__dirname, '..', 'store-service', 'store.js')).Store;
var ip = process.argv[2], ID = 'tv.stremioorigin.app';
if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip || '')) {
  console.error('usage: node tools/install_stremio.js <TV IP>');
  process.exit(2);
}

(async function () {
  var k = require('./ares_key.js')(ip);
  var store = new Store({host: ip, port: k.port, user: k.user, key: k.key, passphrase: k.passphrase, log: function () {}});
  var conn = await store.connect(), apps;
  try { apps = await store.devApps(conn) || []; } finally { conn.end(); }
  if (apps.some(function (a) { return a.id === ID; })) { console.log('Stremio Claude ya estaba instalado: se queda como está (la Tienda lo actualiza).'); return; }
  var r = store.start(ID, 'unofficial', false);
  if (!r.ok) throw new Error(r.error);
  var last = '';
  while (store.busy || store.job.phase === 'starting') {
    if (store.job.phase !== last) { last = store.job.phase; if (last && last !== 'idle') console.log('  ' + last + (store.job.title ? ' · ' + store.job.title : '')); }
    await new Promise(function (res) { setTimeout(res, 1000); });
  }
  if (store.job.phase !== 'done') throw new Error(store.job.message || store.job.phase);
  console.log('Stremio Claude instalado (paquete comprobado con su SHA-256).');
})().catch(function (e) {
  console.error('No se pudo instalar Stremio Claude: ' + (e && e.message ? e.message : e) + '. FreeTV sí está instalado; la Tienda de la tele lo ofrece.');
  process.exit(1);
});
