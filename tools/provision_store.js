#!/usr/bin/env node
'use strict';
/*
 * Gives FreeTV's store service on the TV the key it needs to install apps by itself (see store-service/store.js). Run
 * once, by install.sh, after the packages are installed:
 *
 *   node tools/provision_store.js <TV IP>
 *
 * What it does: reads the Developer Mode SSH key that `ares` already uses for this TV (the one you unlocked with the TV's
 * passphrase), takes the passphrase off it in memory, and writes it into the service's own folder on the TV
 * (.../com.gathin.tvhome.store/state/key.pem, readable only by the Developer Mode group) over the same encrypted SSH
 * session. The passphrase never leaves this computer, and nothing here prints the key. To take the permission away:
 *
 *   node tools/provision_store.js <TV IP> --forget
 */
var crypto = require('crypto'), path = require('path');
var Store = require(path.join(__dirname, '..', 'store-service', 'store.js')).Store;
var ip = process.argv[2], forget = process.argv.indexOf('--forget') > 0;
if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip || '')) {
  console.error('usage: node tools/provision_store.js <TV IP> [--forget]');
  process.exit(2);
}
var STATE = '/media/developer/apps/usr/palm/services/com.gathin.tvhome.store/state';

(async function () {
  var k = require('./ares_key.js')(ip);
  var store = new Store({host: ip, port: k.port, user: k.user, key: k.key, passphrase: k.passphrase});
  var conn = await store.connect();
  try {
    var has = await store.exec(conn, 'test -d ' + STATE + ' && echo yes');
    if (has.out.indexOf('yes') < 0) {
      console.error('La tele no tiene todavía el servicio de la tienda instalado (falta ' + STATE + ').');
      process.exit(1);
    }
    if (forget) {
      await store.exec(conn, '/bin/rm -f ' + STATE + '/key.pem');
      console.log('Permiso retirado: la tienda de la tele ya no puede instalar por sí sola.');
      return;
    }
    var plain = crypto.createPrivateKey({key: k.key, passphrase: k.passphrase}).export({type: 'pkcs1', format: 'pem'});
    var want = crypto.createHash('sha256').update(plain).digest('hex');
    await new Promise(function (resolve, reject) {
      conn.exec('umask 027; cat > ' + STATE + '/.key.tmp', function (err, stream) {
        if (err) { reject(err); return; }
        stream.on('close', function (code) { (code === 0 || code === null || code === undefined) ? resolve() : reject(new Error('cat terminó con ' + code)); });
        stream.end(plain);
      });
    });
    var r = await store.exec(conn, '/bin/chmod 640 ' + STATE + '/.key.tmp && sha256sum ' + STATE + '/.key.tmp');
    if ((r.out.trim().split(/\s+/)[0] || '') !== want) {
      await store.exec(conn, '/bin/rm -f ' + STATE + '/.key.tmp');
      console.error('La clave no llegó entera a la tele: no la dejo puesta.');
      process.exit(1);
    }
    await store.exec(conn, '/bin/mv -f ' + STATE + '/.key.tmp ' + STATE + '/key.pem');
    console.log('La tienda de la tele ya puede instalar apps por sí sola (clave puesta y comprobada).');
  } finally {
    conn.end();
  }
})().catch(function (e) { console.error('No se pudo:', e.message); process.exit(1); });
