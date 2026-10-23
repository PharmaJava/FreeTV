'use strict';
/* Finds the TV's Developer Mode SSH key the way LG's `ares` tools stored it (~/.ssh/<device>_webos and
   ~/.webos/tv/novacom-devices.json). It is read in memory and never printed. */
var fs = require('fs'), os = require('os'), path = require('path');

module.exports = function (ip) {
  var name = 'clean-your-tv-' + ip.replace(/\./g, '-');
  var profiles = path.join(os.homedir(), '.webos', 'tv', 'novacom-devices.json'), list;
  try { list = JSON.parse(fs.readFileSync(profiles, 'utf8')); }
  catch (e) { throw new Error('No encuentro el perfil de la tele (' + profiles + '). Ejecuta antes bash install.sh ' + ip + '.'); }
  var dev = list.filter(function (d) { return d.name === name; })[0];
  if (!dev) throw new Error('No hay un perfil «' + name + '». Ejecuta antes bash install.sh ' + ip + '.');
  var file = dev.privateKey && typeof dev.privateKey === 'object' ? dev.privateKey.openSsh : dev.privateKey;   // {openSsh: 'file'} in ares 3.x
  if (typeof file !== 'string') throw new Error('El perfil «' + name + '» no indica dónde está su clave.');
  var keyPath = path.isAbsolute(file) ? file : path.join(os.homedir(), '.ssh', file);
  return {
    name: name,
    host: dev.host,
    port: parseInt(dev.port, 10) || 9922,
    user: dev.username || 'prisoner',
    key: fs.readFileSync(keyPath, 'utf8'),
    passphrase: dev.passphrase || undefined
  };
};
