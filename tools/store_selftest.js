#!/usr/bin/env node
'use strict';
/*
 * Runs the TV-side store code (store-service/store.js) from this computer, with the same key `ares` uses, to check it
 * against your TV without the service being installed. Same code, same commands.
 *
 *   node tools/store_selftest.js 192.168.1.140                    # can it open the SSH session?
 *   node tools/store_selftest.js 192.168.1.140 <app id> [flag]    # install an app from the catalogue (it asks nothing: be careful)
 *
 * It prints the phases (downloading, verifying, installing, done/failed), never the key.
 */
var path = require('path');
var Store = require(path.join(__dirname, '..', 'store-service', 'store.js')).Store;
var ip = process.argv[2], appId = process.argv[3], flag = process.argv[4] || '';
if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip || '')) {
  console.error('usage: node tools/store_selftest.js <TV IP> [app id] [flag]');
  process.exit(2);
}
var k = require('./ares_key.js')(ip);
var store = new Store({host: ip, port: k.port, user: k.user, key: k.key, passphrase: k.passphrase,
  log: function (m) { console.log('  log:', m); }});
store.check().then(function (r) {
  console.log('SSH session to the TV:', r.ok ? 'ok' : 'FAILED ' + r.error);
  if (!r.ok || !appId) return;
  var seen = '', timer = setInterval(function () {
    var j = store.job;
    var line = j.phase + (j.title ? ' · ' + j.title : '') + (j.note ? ' · NOTE: ' + j.note : '') + (j.message ? ' · ' + j.message : '');
    if (line !== seen) { seen = line; console.log('  job:', line); }
    if (j.phase === 'done' || j.phase === 'failed') { clearInterval(timer); process.exit(j.phase === 'done' ? 0 : 1); }
  }, 500);
  var s = store.start(appId, flag);
  if (!s.ok) { console.log('not started:', s.error); process.exit(1); }
});
