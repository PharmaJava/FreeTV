'use strict';
// The torrent service, run the way TizenBrew runs it (a vm with the service's own require), against a local seeder: needs `webtorrent` (npm i webtorrent@1.9.7,
// only for this test) on NODE_PATH. Checks: create, the whole file, a range from the middle, the last bytes, a second torrent replacing the first, errors.
const vm = require('vm'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), crypto = require('crypto'), assert = require('assert');
const WebTorrent = require('webtorrent');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'freetv-torrent-test-'));
function request(port, method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const r = http.request({host: '127.0.0.1', port, method, path: url, headers: Object.assign(body ? {'Content-Type': 'application/json'} : {}, headers || {})}, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks)}));
    });
    r.on('error', reject); r.setTimeout(60000, () => r.destroy(new Error('timeout'))); r.end(body ? JSON.stringify(body) : undefined);
  });
}
function seed(client, name, size) {
  const file = path.join(tmp, 'seed-' + name + '.mkv'), data = crypto.randomBytes(size);
  fs.writeFileSync(file, data);
  return new Promise((resolve) => client.seed(file, {announce: [], name: 'seed-' + name + '.mkv'}, (t) => resolve({t, data})));
}
(async () => {
  const seeder = new WebTorrent({dht: false, tracker: false, lsd: false, utp: false, webSeeds: false});
  const a = await seed(seeder, 'a', 9 * 1024 * 1024 + 12345), b = await seed(seeder, 'b', 3 * 1024 * 1024);
  await new Promise((r) => seeder.torrentPort ? r() : setTimeout(r, 300));
  const seedPort = seeder.torrentPort;
  const port = 20000 + Math.floor(Math.random() * 20000);
  // TizenBrew's serviceLauncher, as it is: a sandbox with the service's globals and its require
  const sandbox = {};
  Object.getOwnPropertyNames(global).forEach((p) => { if (['services', 'module', 'global', 'inDebug', 'currentClient', 'currentModule'].indexOf(p) < 0) sandbox[p] = global[p]; });
  process.env.FREETV_TORRENT_PORT = String(port); process.env.FREETV_TORRENT_DIR = path.join(tmp, 'data'); process.env.FREETV_TORRENT_METADATA_MS = '8000';
  sandbox.require = require; sandbox.tizen = undefined; sandbox.module = {exports: {}};
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'service.js'), 'utf8'), vm.createContext(sandbox));
  await new Promise((r) => setTimeout(r, 400));

  let r = await request(port, 'GET', '/status');
  assert.strictEqual(r.status, 200); assert.strictEqual(JSON.parse(r.body).ok, true); assert.strictEqual(r.headers['access-control-allow-origin'], '*');
  assert.strictEqual((await request(port, 'OPTIONS', '/status')).status, 204);
  // not created yet
  assert.strictEqual((await request(port, 'GET', '/' + a.t.infoHash + '/0')).status, 404);
  // create
  r = await request(port, 'POST', '/' + a.t.infoHash + '/create', {torrent: {infoHash: a.t.infoHash}, peerSearch: {sources: ['dht:' + a.t.infoHash]}, guessFileIdx: {}, peers: ['127.0.0.1:' + seedPort]});
  assert.strictEqual(r.status, 200, r.body.toString());
  let j = JSON.parse(r.body);
  assert.strictEqual(j.files.length, 1); assert.strictEqual(j.guessedFileIdx, 0); assert.strictEqual(j.files[0].length, a.data.length);
  // the whole file
  r = await request(port, 'GET', '/' + a.t.infoHash + '/0');
  assert.strictEqual(r.status, 200); assert.strictEqual(r.headers['accept-ranges'], 'bytes'); assert.ok(r.body.equals(a.data), 'whole file equal');
  // a range from the middle (what a player does when seeking), then the end
  r = await request(port, 'GET', '/' + a.t.infoHash + '/0', null, {Range: 'bytes=5000000-5100000'});
  assert.strictEqual(r.status, 206); assert.strictEqual(r.headers['content-range'], 'bytes 5000000-5100000/' + a.data.length); assert.ok(r.body.equals(a.data.slice(5000000, 5100001)), 'middle range equal');
  r = await request(port, 'GET', '/' + a.t.infoHash + '/0', null, {Range: 'bytes=-1000'});
  assert.strictEqual(r.status, 206); assert.ok(r.body.equals(a.data.slice(a.data.length - 1000)), 'tail equal');
  r = await request(port, 'GET', '/' + a.t.infoHash + '/0', null, {Range: 'bytes=99999999-'});
  assert.strictEqual(r.status, 416);
  // another torrent replaces the first (one at a time, the TV has little room)
  r = await request(port, 'POST', '/' + b.t.infoHash + '/create', {peers: ['127.0.0.1:' + seedPort]});
  assert.strictEqual(r.status, 200, r.body.toString());
  assert.strictEqual((await request(port, 'GET', '/' + a.t.infoHash + '/0')).status, 404, 'the first one is gone');
  r = await request(port, 'GET', '/' + b.t.infoHash + '/0');
  assert.ok(r.body.equals(b.data), 'second torrent equal');
  assert.ok(!fs.existsSync(path.join(tmp, 'data', a.t.infoHash)), 'the first one\'s data was removed');
  // no peers: a clear timeout, and the service keeps answering
  r = await request(port, 'POST', '/' + 'c'.repeat(40) + '/create', {});
  assert.strictEqual(r.status, 504, r.body.toString());
  assert.strictEqual((await request(port, 'GET', '/status')).status, 200);
  assert.strictEqual((await request(port, 'GET', '/nonsense')).status, 404);
  console.log('ALL OK (node ' + process.version + ', seeder on ' + seedPort + ')');
  seeder.destroy(); fs.rmSync(tmp, {recursive: true, force: true}); process.exit(0);
})().catch((e) => { console.error('FAIL', e); try { fs.rmSync(tmp, {recursive: true, force: true}); } catch (x) { /* */ } process.exit(1); });
