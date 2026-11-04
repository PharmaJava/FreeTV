#!/usr/bin/env node
'use strict';
/*
 * The report FreeTV saved on the TV (Home Settings → Maintenance → Diagnostics → Save the report on the TV), on the computer:
 *
 *   node tools/diagnostics.js <IP>
 *
 * It has no keys, names, cities or PINs: paste it into a GitHub issue. Uses the Developer Mode key install.sh saved.
 */
var path = require('path');
var Store = require(path.join(__dirname, '..', 'store-service', 'store.js')).Store;
var FILE = '/media/developer/apps/usr/palm/services/com.gathin.tvhome.store/state/diagnostics.txt';
var ip = process.argv[2];
if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip || '')) { console.error('node tools/diagnostics.js <IP>'); process.exit(2); }
var k = require('./ares_key.js')(ip);
var store = new Store({host: ip, port: k.port, user: k.user, key: k.key, passphrase: k.passphrase});
(async function () {
  var conn = await store.connect();
  try {
    var r = await store.exec(conn, 'cat ' + FILE);
    if (!r.out.trim()) throw new Error('There is no report on the TV yet: on the TV, Home Settings → Maintenance → Diagnostics → Save the report on the TV.');
    process.stdout.write(r.out);
  } finally { conn.end(); }
})().catch(function (e) { console.error(e.message || e); process.exit(1); });
