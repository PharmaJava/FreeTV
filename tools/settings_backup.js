#!/usr/bin/env node
'use strict';
/*
 * A copy of FreeTV's settings on the computer, to keep or to take to another TV (LG):
 *
 *   node tools/settings_backup.js <IP> export > my-settings.json
 *   node tools/settings_backup.js <IP> import my-settings.json
 *
 * It uses the TV's Developer Mode SSH key that install.sh saved (tools/ares_key.js). export prints the copy FreeTV keeps on the TV
 * (Home Settings → Maintenance → Save a copy of the settings); import puts a copy there, and then, on the TV, Home Settings →
 * Maintenance → Restore the saved copy uses it. The keys FreeTV got from the TV's remote API are left out of an export: they only
 * work on the TV that gave them.
 */
var fs = require('fs'), path = require('path');
var Store = require(path.join(__dirname, '..', 'store-service', 'store.js')).Store;
var STATE = '/media/developer/apps/usr/palm/services/com.gathin.tvhome.store/state/prefs.json';
var MINE = /^fmtv\.(prefs|usage)$/;

function usage() {
  console.error('node tools/settings_backup.js <IP> export > my-settings.json\nnode tools/settings_backup.js <IP> import my-settings.json');
  process.exit(2);
}

var ip = process.argv[2], what = process.argv[3], file = process.argv[4];
if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip || '') || (what !== 'export' && what !== 'import') || (what === 'import' && !file)) usage();

var k = require('./ares_key.js')(ip);
var store = new Store({host: ip, port: k.port, user: k.user, key: k.key, passphrase: k.passphrase});

(async function () {
  var conn = await store.connect();
  try {
    if (what === 'export') {
      var r = await store.exec(conn, 'cat ' + STATE);
      var data = JSON.parse(r.out || '{}'), out = {freetv: 'settings', at: new Date().toISOString(), data: {}};
      Object.keys(data).forEach(function (key) { if (MINE.test(key)) out.data[key] = data[key]; });
      if (!out.data['fmtv.prefs']) throw new Error('There is no copy on the TV yet: on the TV, Home Settings → Maintenance → Save a copy of the settings.');
      process.stdout.write(JSON.stringify(out, null, 1) + '\n');
      return;
    }
    var copy = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!copy || copy.freetv !== 'settings' || !copy.data || typeof copy.data['fmtv.prefs'] !== 'string') throw new Error(file + ' is not a FreeTV settings copy.');
    var have = {};
    try { have = JSON.parse((await store.exec(conn, 'cat ' + STATE)).out || '{}'); } catch (e) {}
    Object.keys(copy.data).forEach(function (key) { if (MINE.test(key) && typeof copy.data[key] === 'string') have[key] = copy.data[key]; });
    var b64 = Buffer.from(JSON.stringify(have)).toString('base64');
    var w = await store.exec(conn, 'echo ' + b64 + ' | base64 -d > ' + STATE + '.tmp && chmod 640 ' + STATE + '.tmp && mv ' + STATE + '.tmp ' + STATE + ' && echo OK');
    if (!/OK/.test(w.out)) throw new Error('The TV did not take the copy: ' + (w.err || w.out).trim());
    console.error('Copy saved on the TV. On the TV: Home Settings → Maintenance → Restore the saved copy.');
  } finally {
    conn.end();
  }
})().catch(function (e) { console.error(e.message || e); process.exit(1); });
