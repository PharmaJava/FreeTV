'use strict';
/*
 * FreeTV's checks that need neither a TV nor the internet:  node tests/run.js
 * (the store service's logic with a mocked TV shell, and the shape of what the screen builds). CI runs it on every push.
 */
var assert = require('assert'), path = require('path'), fs = require('fs');
var root = path.join(__dirname, '..');
var store = require(path.join(root, 'store-service', 'store.js')), Store = store.Store, isNewer = store.isNewer;
var passed = 0;

function ok(name, fn) {
  return Promise.resolve().then(fn).then(function () {
    passed++;
    console.log('  ok   ' + name);
  }, function (e) {
    console.log('  FAIL ' + name + ': ' + (e && e.message || e));
    process.exitCode = 1;
  });
}

var HASH = new Array(65).join('a');
function app(id, version, extra) {
  var m = {version: version, rootRequired: false, ipkUrl: 'https://example.com/' + id + '.ipk', ipkHash: {sha256: HASH}};
  for (var k in extra) m[k] = extra[k];
  return {id: id, title: id, manifest: m};
}

function fake(catalogue, installed) {
  var s = new Store({});
  s.connect = function () { return Promise.resolve({end: function () {}}); };
  s.catalogue = function () { return Promise.resolve(catalogue); };
  s.devApps = function () { return Promise.resolve(installed); };
  s.exec = function () { return Promise.resolve({code: 0, out: '', err: ''}); };
  s.freeMb = function () { return Promise.resolve(250); };
  return s;
}

function answer(minutes) {
  return {code: 0, out: '{"result":"success","errorCode":"200","errorMsg":"' + minutes + '"}', err: ''};
}

Promise.resolve()
  .then(function () {
    console.log('versions and updates');
    return ok('version comparison', function () {
      [['1.2.3', '1.2.2', true], ['1.2', '1.2.0', false], ['1.10', '1.9', true], ['2.0.6-beta', '2.0.5', true], ['1.2.0', '1.2.0-beta', true],
       ['1.2.0-beta', '1.2.0', false], ['21.90.901', '21.90.900', true], ['abc', '1.0', false], ['1.0', '', false], ['v1.1', '1.0.9', true]].forEach(function (t) {
        assert.strictEqual(isNewer(t[0], t[1]), t[2], t[0] + ' vs ' + t[1]);
      });
    });
  })
  .then(function () {
    return ok('only safe apps with a newer version are offered', function () {
      var s = fake([app('a.new', '2.0'), app('a.same', '1.0'), app('a.root', '3.0', {rootRequired: true}), app('youtube.leanback.v4', '0.6.0'),
                    app('com.open.hidden.menu', '9.0'), app('a.nohash', '5.0', {ipkHash: {}}), app('a.http', '5.0', {ipkUrl: 'http://example.com/x.ipk'}),
                    app('a.notinstalled', '9.9')],
                   [{id: 'a.new', version: '1.0'}, {id: 'a.same', version: '1.0'}, {id: 'a.root', version: '1.0'}, {id: 'youtube.leanback.v4', version: '0.5.3'},
                    {id: 'com.open.hidden.menu', version: '1.0'}, {id: 'a.nohash', version: '1.0'}, {id: 'a.http', version: '1.0'}, {id: 'a.local', version: '1.0'}]);
      return s.updates(null).then(function (r) {
        assert.deepStrictEqual(r.list.map(function (u) { return u.id; }), ['a.new', 'youtube.leanback.v4', 'com.open.hidden.menu']);
        assert.strictEqual(r.list[2].flag, 'sensitive');
        assert.strictEqual(r.list[1].flag, '');   // "delete the official first" only matters for the first install
        assert.strictEqual(r.installed['a.local'], '1.0');
      });
    });
  })
  .then(function () {
    return ok('update all leaves out what needs a confirmation, one at a time', function () {
      var s = fake([app('a.new', '2.0'), app('com.open.hidden.menu', '9.0'), app('b.new', '2.0')],
                   [{id: 'a.new', version: '1'}, {id: 'com.open.hidden.menu', version: '1'}, {id: 'b.new', version: '1'}]);
      var ran = [];
      s.run = function (id, flag, opts) {
        ran.push(id + ':' + (opts.inBatch ? 'batch' : ''));
        s.set({phase: 'done', id: id});
        return Promise.resolve();
      };
      assert.strictEqual(s.startUpdateAll().ok, true);
      assert.strictEqual(s.startUpdateAll().ok, false, 'a second batch while one runs');
      return new Promise(function (res) {
        var t = setInterval(function () { if (s.job.batch && s.job.batch.finished) { clearInterval(t); res(); } }, 10);
      }).then(function () {
        assert.deepStrictEqual(ran, ['a.new:batch', 'b.new:batch']);
        assert.strictEqual(s.job.batch.done, 2);
        assert.strictEqual(s.busy, false);
      });
    });
  })
  .then(function () {
    console.log('developer mode');
    return ok('time left is read from LG without the token leaving the command', function () {
      var s = fake([], []), seen = '';
      s.exec = function (conn, cmd) { seen = cmd; return Promise.resolve(answer('879:51:25')); };
      return s.devmodeLeft(null, 'check').then(function (r) {
        assert.strictEqual(r.ok, true);
        assert.ok(Math.abs(r.hours - 879.857) < 0.01);
        assert.ok(/devmode_enabled/.test(seen) && /\$T/.test(seen) && /<hidden>/.test(seen), 'token read and masked inside the command');
        assert.ok(!/[0-9a-f]{40}/i.test(seen), 'no token value in the command');
      });
    });
  })
  .then(function () {
    return ok('a renewal counts only when the countdown grew', function () {
      var answers = [answer('100:00:00'), answer('GNL'), answer('100:00:00')], n = 0, s = fake([], []);
      s.exec = function () { return Promise.resolve(answers[n++]); };
      return s.devmodeTick(336).then(function (r) {
        assert.strictEqual(r.ok, false, 'a generic success is not a renewal');
        assert.ok(/contador/.test(r.error));
      });
    });
  })
  .then(function () {
    return ok('a renewal that raised the countdown is confirmed', function () {
      var answers = [answer('100:00:00'), answer('GNL'), answer('999:59:56')], n = 0, s = fake([], []);
      s.exec = function () { return Promise.resolve(answers[n++]); };
      return s.devmodeTick(336).then(function (r) {
        assert.strictEqual(r.ok, true);
        assert.strictEqual(r.extended, true);
        assert.ok(r.after > 999);
      });
    });
  })
  .then(function () {
    return ok('nothing is renewed while plenty is left', function () {
      var s = fake([], []), calls = 0;
      s.exec = function () { calls++; return Promise.resolve(answer('900:00:00')); };
      return s.devmodeTick(336).then(function (r) {
        assert.strictEqual(r.extended, false);
        assert.strictEqual(calls, 1);
      });
    });
  })
  .then(function () {
    console.log('the home screen');
    return ok('every home script parses and every tr() has its three languages', function () {
      var dir = path.join(root, 'home'), bad = [];
      fs.readdirSync(dir).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
        try { new Function(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { bad.push(f + ': ' + e.message); }
      });
      assert.deepStrictEqual(bad, []);
      var home = fs.readFileSync(path.join(dir, 'home.js'), 'utf8'), empty = [], str = "'(?:[^'\\\\]|\\\\.)*'";
      (home.match(new RegExp('\\btr\\(' + str + ',\\s*' + str + ',\\s*' + str + '\\)', 'g')) || []).forEach(function (call) {
        if (/,\s*''\s*[,)]|tr\(''/.test(call)) empty.push(call.slice(0, 70));
      });
      assert.deepStrictEqual(empty, []);
    });
  })
  .then(function () {
    return ok('the TV shows FreeTV and this version while it starts', function () {
      var info = JSON.parse(fs.readFileSync(path.join(root, 'home', 'appinfo.json'), 'utf8'));
      assert.strictEqual(info.title, 'FreeTV');
      assert.strictEqual(info.splashBackground, 'splash.png');
      var png = fs.readFileSync(path.join(root, 'home', info.splashBackground)), at = 8, version = null;
      while (at < png.length) {   // the version tools/make_splash.py wrote in a tEXt chunk
        var len = png.readUInt32BE(at), type = png.toString('latin1', at + 4, at + 8);
        if (type === 'tEXt') {
          var kv = png.toString('latin1', at + 8, at + 8 + len).split('\0');
          if (kv[0] === 'version') version = kv[1];
        }
        at += 12 + len;
      }
      assert.strictEqual(version, info.version, 'run python3 tools/make_splash.py after changing the version');
    });
  })
  .then(function () {
    console.log('diagnostics and my list');
    var js = fs.readFileSync(path.join(root, 'home', 'home.js'), 'utf8'), svc = fs.readFileSync(path.join(root, 'store-service', 'service.js'), 'utf8');
    return ok('the diagnostics report and my list are registered, and the report carries no keys or names', function () {
      assert.ok(/INFO\.diag = infoDiag;/.test(js) && /INFO\.watchlist = infoWatchlist;/.test(js), 'both sheets are registered next to the table');
      assert.ok(/service\.register\('diagSave'/.test(svc), 'the service keeps the report');
      var report = /function diagReport\(\) \{[\s\S]*?\n  \}\n/.exec(js)[0];
      assert.ok(!/tmdbKey|userName|city|kidsPin|ssapKey|Key\b/.test(report.replace(/ssapKey/g, '')), 'nothing secret or personal in the report');
      assert.ok(/openPickMenu\(p\)/.test(js), 'holding OK on a pick opens its menu');
      assert.ok(/service\.register\('appDataProbe'/.test(svc) && /\^\[a-z0-9\]\[a-z0-9\.\\-\]\{2,60\}\$/.test(svc), 'the probe takes only an app id');
      assert.ok(!/cat |readFile|grep /.test(/service\.register\('appDataProbe'[\s\S]*?\n\}\);/.exec(svc)[0]), 'it lists names and permissions, never contents');
    });
  })
  .then(function () {
    console.log('the store without its main catalogue');
    return ok('when the main catalogue cannot be read the other sources still install, and with none it is an error as before', async function () {
      var other = {id: 'com.rezkatv.app', manifest: {id: 'com.rezkatv.app', version: '1.0.0', rootRequired: false}}, calls = [];
      var s = new Store({});
      s.exec = async function (c, cmd) {
        calls.push(cmd);
        if (/repo\.webosbrew\.org/.test(cmd)) return {code: 60, out: '', err: 'curl: (60) SSL certificate problem: self signed certificate'};
        if (/rezkatv/.test(cmd)) return {code: 0, out: JSON.stringify({packages: [other]}), err: ''};
        return {code: 22, out: '', err: 'x'};
      };
      var apps = await s.catalogue(null);
      assert.ok(apps.some(function (a) { return a.id === 'com.rezkatv.app'; }), 'the other source is offered');
      s.exec = async function () { return {code: 60, out: '', err: 'curl: (60) SSL certificate problem'}; };
      var failed = false;
      try { await s.catalogue(null); } catch (e) { failed = /No pude leer el catálogo/.test(e.message); }
      assert.ok(failed, 'with nothing reachable: the same error');
    });
  })
  .then(function () {
    console.log('apps from a GitHub link');
    return ok('a GitHub project is offered only with its .ipk and the hash its own release publishes for that file', async function () {
      assert.strictEqual(store.githubRepo('https://github.com/silirim/VodMax/releases/tag/v1'), 'silirim/VodMax');
      assert.strictEqual(store.githubRepo('github.com/a/b.git'), 'a/b');
      assert.strictEqual(store.githubRepo('a/b'), 'a/b');
      assert.strictEqual(store.githubRepo('https://evil.example/a/b'), '');
      var good = 'a'.repeat(64), rel = {assets: [
        {name: 'app.demo.client_1.2.3_all.ipk', size: 10, browser_download_url: 'https://github.com/o/r/releases/download/v1.2.3/app.demo.client_1.2.3_all.ipk'},
        {name: 'SHA256SUMS', browser_download_url: 'https://github.com/o/r/releases/download/v1.2.3/SHA256SUMS'}]};
      function fake(sums) {
        var s = new Store({});
        s.exec = async function (c, cmd) {
          if (/api\.github\.com/.test(cmd)) return {code: 0, out: JSON.stringify(rel), err: ''};
          if (/SHA256SUMS/.test(cmd)) return {code: 0, out: sums, err: ''};
          return {code: 22, out: '', err: ''};
        };
        return s;
      }
      var p = await fake(good + '  app.demo.client_1.2.3_all.ipk\n').githubPackage(null, 'o/r');
      assert.strictEqual(p.id, 'app.demo.client');
      assert.strictEqual(p.manifest.version, '1.2.3');
      assert.strictEqual(p.manifest.ipkHash.sha256, good);
      assert.strictEqual(p.github, true);
      var refused = false;
      try { await fake('b'.repeat(64) + '  another.ipk\n').githubPackage(null, 'o2/r2'); } catch (e) { refused = /no publica el hash/.test(e.message); }
      assert.ok(refused, 'no hash for that file: refused');
    });
  })
  .then(function () {
    console.log('Jellyfin and Plex in Continue watching');
    var ms = require(path.join(root, 'store-service', 'mediaservers.js')), os2 = require('os');
    var mdir = fs.mkdtempSync(path.join(os2.tmpdir(), 'freetv-media-'));
    return ok('Jellyfin and Plex give started titles with the minutes left, and only tokens are kept (never the password)', async function () {
      var jf = ms.jfPick([
        {Id: 'a1', Type: 'Episode', Name: 'Pilot', SeriesName: 'Show', SeriesId: 's1', SeriesPrimaryImageTag: 'tg', ParentIndexNumber: 2, IndexNumber: 5, RunTimeTicks: 30000000000, UserData: {PlaybackPositionTicks: 12000000000, LastPlayedDate: '2026-11-09T10:00:00Z'}},
        {Id: 'a2', Type: 'Movie', Name: 'Done', RunTimeTicks: 1000000000, UserData: {PlaybackPositionTicks: 990000000}},
        {Id: 'a3', Type: 'Movie', Name: 'Fresh', RunTimeTicks: 1000000000, UserData: {PlaybackPositionTicks: 0}},
        {Id: 'a4', Type: 'Movie', Name: 'Film', ImageTags: {Primary: 'pt'}, RunTimeTicks: 6000000000, UserData: {PlaybackPositionTicks: 3000000000, LastPlayedDate: '2026-11-10T10:00:00Z'}}], 'http://nas:8096');
      assert.strictEqual(jf.length, 2, 'finished and not started are left out');
      assert.strictEqual(jf[0].name, 'Film');
      assert.strictEqual(jf[1].ep, 'T2 · E5');
      assert.strictEqual(jf[1].pct, 40);
      assert.strictEqual(jf[1].left, 30, '30 minutes left');
      assert.ok(/^http:\/\/nas:8096\/Items\/s1\/Images\/Primary/.test(jf[1].poster), 'an episode shows its series poster');
      var px = ms.plexPick([
        {ratingKey: '9', type: 'episode', title: 'E', grandparentTitle: 'Plex Show', parentIndex: 1, index: 3, viewOffset: 600000, duration: 2400000, lastViewedAt: 1790000000, grandparentThumb: '/library/metadata/1/thumb/1'},
        {ratingKey: '8', type: 'episode', title: 'Up next', grandparentTitle: 'X', duration: 100000}], {uri: 'http://nas:32400', serverToken: 'T'});
      assert.strictEqual(px.length, 1, 'an unstarted up-next episode is not "continue"');
      assert.strictEqual(px[0].left, 30);
      assert.strictEqual(px[0].pct, 25);
      var srv = ms.plexServer([{name: 'Cloud', provides: 'player', connections: []}, {name: 'Home', provides: 'server', accessToken: 'S', connections: [{uri: 'https://x.plex.direct:32400', protocol: 'https', local: false}, {uri: 'http://192.168.1.5:32400', protocol: 'http', local: true}]}], 'A');
      assert.strictEqual(srv.uri, 'http://192.168.1.5:32400');
      assert.strictEqual(srv.serverToken, 'S');
      assert.strictEqual(ms.jfServer('192.168.1.5:8096'), 'http://192.168.1.5:8096');
      assert.strictEqual(ms.jfServer('x y'), '');
      var calls = [];
      ms.setRequest(function (method, url, headers, body, done) {
        calls.push({url: url, body: body});
        if (body && body.Pw === 'good') done(null, {status: 200, json: {AccessToken: 'TOKEN123', User: {Id: 'u1'}}});
        else done(null, {status: 401, json: null});
      });
      var bad = await new Promise(function (r) { ms.jellyfinLogin(mdir, 'nas:8096', 'me', 'wrong', function (e) { r(e); }); });
      assert.ok(bad && bad.message === 'refused');
      assert.ok(!fs.existsSync(path.join(mdir, 'jellyfin.json')), 'a wrong password keeps nothing');
      var okk = await new Promise(function (r) { ms.jellyfinLogin(mdir, 'nas:8096', 'me', 'good', function (e) { r(e); }); });
      assert.strictEqual(okk, null);
      var kept = fs.readFileSync(path.join(mdir, 'jellyfin.json'), 'utf8');
      assert.ok(/TOKEN123/.test(kept) && !/good/.test(kept), 'the token is kept, the password is not');
      ms.logout(mdir, 'jellyfin');
      assert.ok(!fs.existsSync(path.join(mdir, 'jellyfin.json')), 'signing out forgets it');
      var js = fs.readFileSync(path.join(root, 'home', 'home.js'), 'utf8');
      assert.ok(/svcCall\('mediaLoginJellyfin'/.test(js) && /password = '';/.test(js), 'the page clears the password');
      assert.ok(/local: 'media'/.test(js) && /watchMeta\(it\)/.test(js), 'Continue watching merges them');
    });
  })
  .then(function () {
    console.log('picks open in Stremio Origin');
    return ok('a pick can open Stremio Origin with its title and year in front of the person (the app reads no title address)', function () {
      var js = fs.readFileSync(path.join(root, 'home', 'home.js'), 'utf8'), data = fs.readFileSync(path.join(root, 'home', 'data.js'), 'utf8');
      assert.ok(/pickStremio\(\) && p\.kind\) \{ openInStremio\(p\)/.test(js), 'OK on a pick goes there when chosen');
      assert.ok(/function pickStremio\(\) \{ return !!findApp\(STREMIO_APP\); \}/.test(js), 'always, when the app is on the TV');
      assert.ok(!/cycle\('pickOpen'/.test(js), 'no setting can send them elsewhere');
      var svc = fs.readFileSync(path.join(root, 'store-service', 'service.js'), 'utf8');
      assert.ok(/!\/\^\(movie\|series\)\$\/\.test\(type\) \|\| !\/\^tt\\d\{5,10\}\$\/\.test\(id\)/.test(svc), 'the note takes only movie/series and an IMDb id');
      assert.ok(/tmdb\.key \] \|\|/.test(svc), 'the key is given only when the app has none');
      assert.ok(/year: String\(o\.release_date \|\| o\.first_air_date/.test(data), 'a pick knows its year');
    });
  })
  .then(function () {
    console.log('two listings for one app id');
    return ok('the Cobalt YouTube is listed beside the catalogue one, under its own name, and installs with the real id', async function () {
      var cat = {packages: [{id: 'youtube.leanback.v4', title: 'old', manifest: {version: '0.5.3'}}]};
      var s = new Store({});
      var cobalt = {id: 'youtube.leanback.v4', title: 'Cobalt', manifest: {id: 'youtube.leanback.v4', version: '2.0.1', rootRequired: false, ipkUrl: 'https://github.com/RF1705/x/releases/download/v/y.ipk', ipkHash: {sha256: 'a'.repeat(64)}}};
      s.exec = async function (c, cmd) {
        if (/repo\.webosbrew\.org/.test(cmd)) return {code: 0, out: JSON.stringify(cat), err: ''};
        if (/RF1705/.test(cmd)) return {code: 0, out: JSON.stringify({packages: [cobalt, {id: 'youtube.leanback.v4.beta', title: 'beta', manifest: {}}]}), err: ''};
        return {code: 22, out: '', err: ''};
      };
      var apps = await s.catalogue(null);
      var plain = apps.filter(function (a) { return a.id === 'youtube.leanback.v4'; }), alt = apps.filter(function (a) { return a.id === 'youtube.leanback.v4.cobalt'; });
      assert.strictEqual(plain.length, 1, 'the catalogue entry stays');
      assert.strictEqual(plain[0].title, 'old');
      assert.strictEqual(alt.length, 1, 'the Cobalt one is listed too');
      assert.strictEqual(alt[0].realId, 'youtube.leanback.v4');
      assert.ok(!apps.some(function (a) { return a.id === 'youtube.leanback.v4.beta'; }), 'only the listed id is taken');
      var js = fs.readFileSync(path.join(root, 'store-service', 'store.js'), 'utf8');
      assert.ok(/JSON\.stringify\(\{id: realId, ipkUrl: file/.test(js), 'the TV installs it under its real id');
    });
  })
  .then(function () {
    console.log('the screen guard');
    return ok('LG\'s screensaver is sent away only while a video moved in the last 75 seconds, and the guard never prompts or keeps a key', function () {
      var g = require(path.join(root, 'store-service', 'screenguard.js')), now = Date.parse('2026-11-11T22:57:30Z');
      assert.strictEqual(g.playing('2026-11-11T22:57:20.078Z [video] ev {"currentTime":{"currentTime":1}}\n', now), true, 'playing');
      assert.strictEqual(g.playing('2026-11-11T22:50:20.078Z [video] ev {"currentTime":{"currentTime":1}}\n', now), false, 'paused for minutes: LG\'s screensaver may come');
      assert.strictEqual(g.playing('2026-11-11T22:57:20.078Z [frame] 300 drawn\n', now), false, 'the menus are not a video');
      assert.ok(g.saverComing({processing: 'Request Screen Saver'}) && g.saverComing({state: 'Screen Saver'}) && !g.saverComing({state: 'Active'}));
      var r = g.parse(Buffer.concat([Buffer.from([0x81, 5]), Buffer.from('hello'), Buffer.from([0x81, 126, 0, 200]), Buffer.alloc(200, 97), Buffer.from([0x81, 9])]));
      assert.strictEqual(r.frames.length, 2);
      assert.strictEqual(r.frames[1].text.length, 200);
      assert.strictEqual(r.rest.length, 2, 'half a frame waits for the rest');
      var f = g.frame('{"a":1}');
      assert.strictEqual(f[1] & 0x80, 0x80, 'what the client sends is masked');
      var src = fs.readFileSync(path.join(root, 'store-service', 'screenguard.js'), 'utf8'), svc = fs.readFileSync(path.join(root, 'store-service', 'service.js'), 'utf8');
      assert.ok(/8 \* 3600000/.test(src) && /180000/.test(src), 'it ends by itself');
      assert.ok(/m\.id === 'register' && m\.type === 'error'\) \{[^}]*process\.exit\(0\)/.test(src), 'a refused key ends it: no prompt from the background');
      assert.ok(!/writeFile[^\n]*KEY|writeJson[^\n]*key/.test(src + svc.slice(svc.indexOf("'guardStart'"), svc.indexOf("'companionStart'"))), 'the key is written nowhere');
    });
  })
  .then(function () {
    console.log('Stremio Claude from our repository');
    return ok('the Store offers Stremio Claude from PharmaJava/webos releases, by that name, and no longer reads stremio-origin\'s feed', async function () {
      var rel = {assets: [
        {name: 'tv.stremioorigin.app_1.0.1_arm.ipk', size: 5379900, browser_download_url: 'https://github.com/PharmaJava/webos/releases/download/v1.0.1/tv.stremioorigin.app_1.0.1_arm.ipk'},
        {name: 'SHA256SUMS', browser_download_url: 'https://github.com/PharmaJava/webos/releases/download/v1.0.1/SHA256SUMS'}]};
      var s = new Store({}), asked = [];
      s.exec = async function (c, cmd) {
        asked.push(cmd);
        if (/api\.github\.com\/repos\/PharmaJava\/webos/.test(cmd)) return {code: 0, out: JSON.stringify(rel), err: ''};
        if (/PharmaJava\/webos\/releases\/download\/v1\.0\.1\/SHA256SUMS/.test(cmd)) return {code: 0, out: 'b'.repeat(64) + '  tv.stremioorigin.app_1.0.1_arm.ipk\n', err: ''};
        return {code: 22, out: '', err: ''};
      };
      var p = await s.githubPackage(null, 'PharmaJava/webos');
      assert.strictEqual(p.id, 'tv.stremioorigin.app');
      assert.strictEqual(p.title, 'Stremio Claude');
      assert.strictEqual(p.manifest.version, '1.0.1');
      var src = fs.readFileSync(path.join(root, 'store-service', 'store.js'), 'utf8') + fs.readFileSync(path.join(root, 'home', 'home.js'), 'utf8');
      assert.ok(!/stremio-origin\.github\.io/.test(src), 'stremio-origin\'s feed is not read');
    });
  })
  .then(function () {
    console.log('companion');
    var comp = fs.readFileSync(path.join(root, 'store-service', 'companion.js'), 'utf8');
    return ok('the companion server only takes its three fields, only with the token, and the inbox only from the TV itself', function () {
      assert.ok(/FIELDS = \{name: 24, note: 140, news: 300\}/.test(comp), 'three fields with a length each');
      assert.ok(/d\.f === 'news' && !\/\^https:\\\/\\\//.test(comp), 'the news address must be https');
      assert.ok(/p === '\/inbox' && local/.test(comp) && /p === '\/bye' && local/.test(comp), 'the inbox and bye answer only 127.0.0.1');
      assert.ok(/if \(!ok\(req, query\)\) \{ res\.writeHead\(403\)/.test(comp), 'every other path needs the token');
      assert.ok(/idleMs/.test(comp) && /process\.exit\(0\)/.test(comp), 'it ends by itself');
    });
  })
  .then(function () {
    var QRsrc = fs.readFileSync(path.join(root, 'home', 'qr.js'), 'utf8'), win = {};
    new Function('window', QRsrc)(win);
    return ok('the QR maker builds a square for an address and refuses what does not fit', function () {
      var m = win.QR.make('http://192.168.1.140:8089/?t=0123456789ab');
      assert.ok(m && m.length === m[0].length && m.length >= 25, 'a square matrix');
      assert.strictEqual(win.QR.make(new Array(200).join('x')), null);
    });
  })
  .then(function () {
    console.log('the pointer and the screensaver');
    var css = fs.readFileSync(path.join(root, 'home', 'home.css'), 'utf8');
    return ok('the closed drawer does not take the pointer from the shelf (the Magic Remote could not reach the apps)', function () {
      assert.ok(/^#drawer \{ pointer-events: none; \}/m.test(css), 'a full-screen layer left under the shelf, clear but still there, takes the pointer');
      assert.ok(/^\.drawer-open #drawer \{ pointer-events: auto; \}/m.test(css), 'and it takes it back when it is open');
    });
  })
  .then(function () {
    var css = fs.readFileSync(path.join(root, 'home', 'home.css'), 'utf8');
    return ok('the screensaver is solid in every theme: never transparent, never a fade over the home', function () {
      assert.ok(/^#saver \{[^}]*background: #000;[^}]*opacity: 1;[^}]*transition: none;/m.test(css), 'opaque and instant');
      assert.ok(!/#saver\.dim/.test(css), 'night dimming is a layer inside it (.dimmer), not its opacity');
    });
  })
  .then(function () {
    var home = fs.readFileSync(path.join(root, 'home', 'home.js'), 'utf8');
    return ok('a pointer that did not move cannot move the focus (a scrolling list would run away under it)', function () {
      assert.ok(/pointerRecord/.test(home) && /pointer\.real = moved/.test(home) && /if \(!pointer\.real\) return false;/.test(home));
    });
  })
  .then(function () {
    console.log('FreeTV updating itself');
    var update = require(path.join(root, 'store-service', 'update.js'));
    var base = 'https://github.com/PharmaJava/FreeTV/releases/download/v9.9.0/';
    function release(extra) {
      var r = {tag_name: 'v9.9.0', draft: false, prerelease: false, body: 'Notes', published_at: '2026-11-03T10:00:00Z', assets: [
        {name: 'FreeTV-webos-9.9.0.ipk', browser_download_url: base + 'FreeTV-webos-9.9.0.ipk', size: 1700000},
        {name: 'SHA256SUMS', browser_download_url: base + 'SHA256SUMS', size: 90}]};
      for (var k in extra) r[k] = extra[k];
      return r;
    }
    return ok('a release is read, and only what comes from the repository itself', function () {
      var d = update.describe(release(), 'PharmaJava/FreeTV');
      assert.strictEqual(d.version, '9.9.0');
      assert.strictEqual(d.ipkName, 'FreeTV-webos-9.9.0.ipk');
      assert.strictEqual(update.describe(release({prerelease: true}), 'PharmaJava/FreeTV'), null);
      assert.strictEqual(update.describe(release({draft: true}), 'PharmaJava/FreeTV'), null);
      assert.strictEqual(update.describe(release({tag_name: 'nightly'}), 'PharmaJava/FreeTV'), null);
      assert.strictEqual(update.describe(release({assets: release().assets.slice(0, 1)}), 'PharmaJava/FreeTV'), null, 'no SHA256SUMS: not offered');
      assert.strictEqual(update.describe(release(), 'someone/else'), null, 'assets of another repository');
      var evil = release();
      evil.assets[0].browser_download_url = 'https://evil.example/FreeTV-webos-9.9.0.ipk';
      assert.strictEqual(update.describe(evil, 'PharmaJava/FreeTV'), null);
    });
  })
  .then(function () {
    var update = require(path.join(root, 'store-service', 'update.js'));
    return ok('versions: 2.10 is newer than 2.9, equal is not newer', function () {
      assert.ok(update.isNewer('2.10.0', '2.9.5'));
      assert.ok(update.isNewer('2.2.1', '2.2'));
      assert.ok(!update.isNewer('2.2.0', '2.2'));
      assert.ok(!update.isNewer('2.1.9', '2.2.0'));
    });
  })
  .then(function () {
    function selfFake(sumsText, hashOut) {
      var s = new Store({}), ran = [];
      s.connect = function () { return Promise.resolve({end: function () {}}); };
      s.freeMb = function () { return Promise.resolve(250); };
      s.exec = function (conn, cmd) {
        ran.push(cmd);
        if (/^curl .*65536/.test(cmd)) return Promise.resolve({code: 0, out: sumsText, err: ''});
        if (/^sha256sum/.test(cmd)) return Promise.resolve({code: 0, out: hashOut + '  /media/developer/temp/freetv-self-update.ipk\n', err: ''});
        return Promise.resolve({code: 0, out: '', err: ''});
      };
      s.ran = ran;
      return s;
    }
    var info = {version: '9.9.0', ipkName: 'FreeTV-webos-9.9.0.ipk', size: 1700000,
      ipkUrl: 'https://github.com/PharmaJava/FreeTV/releases/download/v9.9.0/FreeTV-webos-9.9.0.ipk', sumsUrl: 'https://github.com/PharmaJava/FreeTV/releases/download/v9.9.0/SHA256SUMS'};
    var good = new Array(65).join('b');
    return ok('a package whose hash does not match is deleted, not installed', function () {
      var s = selfFake(good + '  FreeTV-webos-9.9.0.ipk\n', new Array(65).join('c'));
      return s.selfUpdate(info).then(function () {
        assert.strictEqual(s.job.phase, 'failed');
        assert.ok(/NO coincide/.test(s.job.message));
        assert.ok(!s.ran.some(function (c) { return /dev\/install/.test(c); }), 'nothing was installed');
        assert.ok(s.ran.some(function (c) { return /rm -f/.test(c); }), 'the package was removed');
      });
    }).then(function () {
      return ok('a release without its hash line is not installed', function () {
        var s = selfFake('', good);
        return s.selfUpdate(info).then(function () {
          assert.strictEqual(s.job.phase, 'failed');
          assert.ok(!s.ran.some(function (c) { return /dev\/install/.test(c); }));
        });
      });
    }).then(function () {
      return ok('a checked package is installed apart from the service, and FreeTV is opened again', function () {
        var s = selfFake(good + '  FreeTV-webos-9.9.0.ipk\n', good);
        return s.selfUpdate(info).then(function () {
          assert.strictEqual(s.job.phase, 'done');
          var script = s.ran.filter(function (c) { return /base64 -d/.test(c); })[0] || '', run = s.ran.filter(function (c) { return /^nohup \/bin\/sh /.test(c); })[0] || '';
          var text = Buffer.from((/echo (\S+) \|/.exec(script) || [])[1] || '', 'base64').toString();
          assert.ok(/dev\/install/.test(text) && /applicationManager\/launch/.test(text) && /com\.gathin\.tvhome/.test(text), 'installs, then opens FreeTV');
          assert.ok(/ &$/.test(run) && /< \/dev\/null/.test(run), 'runs apart from the session');
          assert.strictEqual(s.busy, false);
        });
      });
    });
  })
  .then(function () {
    return ok('a bad address is refused before anything is downloaded', function () {
      var s = new Store({});
      s.connect = function () { throw new Error('should not connect'); };
      return s.selfUpdate({version: '9', ipkName: 'x.ipk', ipkUrl: 'http://x/y; rm -rf /', sumsUrl: 'https://a/b'}).then(function () {
        assert.strictEqual(s.job.phase, 'failed');
      });
    });
  })
  .then(function () {
    console.log('Stremio in Continue watching');
    var z = require(path.join(root, 'store-service', 'stremio.js')), os = require('os');
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'freetv-stremio-')), sent = [];
    var lib = [
      {_id: 'tt1', name: 'Film A', type: 'movie', poster: 'https://img/a.jpg', state: {timeOffset: 600000, duration: 6000000, lastWatched: '2026-11-10T20:00:00Z'}, _mtime: '2026-11-10T20:00:00Z'},
      {_id: 'tt2', name: 'Show B', type: 'series', poster: 'https://img/b.jpg', state: {timeOffset: 900000, duration: 2400000, lastWatched: '2026-11-10T21:00:00Z', video_id: 'tt2:2:5'}, _mtime: '2026-11-10T21:00:00Z'},
      {_id: 'tt3', name: 'Saved only', type: 'movie', state: {timeOffset: 0}, _mtime: '2026-11-10T22:00:00Z'},
      {_id: 'tt4', name: 'Finished', type: 'movie', state: {timeOffset: 5900000, duration: 6000000, lastWatched: '2026-11-10T19:00:00Z'}},
      {_id: 'tt5', name: 'Removed', type: 'movie', removed: true, state: {timeOffset: 1000, duration: 9000, lastWatched: '2026-11-10T23:00:00Z'}},
      {_id: 'tt6', name: 'Channel', type: 'tv', state: {timeOffset: 1000, duration: 9000, lastWatched: '2026-11-10T23:00:00Z'}},
      {_id: 'tt7', name: 'Bad poster', type: 'movie', poster: 'javascript:alert(1)', state: {timeOffset: 1000, duration: 9000, lastWatched: '2026-11-09T10:00:00Z'}}];
    z.setPost(function (method, body, done) {
      sent.push([method, body]);
      if (method === 'login') {
        if (body.password === 'good') done(null, {result: {authKey: 'KEY123', user: {}}}); else done(null, {error: {message: 'Wrong passphrase', code: 2}});
      } else if (body.authKey === 'KEY123') done(null, {result: lib}); else done(null, {error: {message: 'Session does not exist', code: 1}});
    });
    return ok('the Stremio library is read as the Continue watching list: started, not finished, newest first, with an episode and a percentage', function () {
      var items = z.pick(lib);
      assert.deepStrictEqual(items.map(function (x) { return x.id; }), ['tt2', 'tt1', 'tt7'], 'only what was started and not finished, newest first');
      assert.strictEqual(items[0].ep, 'T2 · E5');
      assert.strictEqual(items[0].pct, 38);
      assert.strictEqual(items[0].left, 25, 'minutes left: (2400000 - 900000) ms');
      assert.strictEqual(items[2].poster, '', 'a poster that is not https is dropped');
      assert.strictEqual(z.pick([{_id: 'tt9', name: 'Watched without adding', type: 'movie', temp: true, removed: true, state: {timeOffset: 1000, duration: 9000, lastWatched: '2026-11-10T20:00:00Z'}}]).length, 1, 'a temp title (watched, not in the library) is in Continue watching, as in Stremio');
    }).then(function () {
      return ok('signing in keeps only the session key (mode 640), never the password, and a wrong password keeps nothing', function () {
        return new Promise(function (resolve) {
          z.login(dir, 'a@b.co', 'bad', function (err) {
            assert.ok(err && /Wrong passphrase/.test(err.message) && !z.loggedIn(dir), 'refused');
            z.login(dir, 'a@b.co', 'good', function (err2) {
              assert.ok(!err2 && z.loggedIn(dir));
              var f = path.join(dir, 'stremio.json'), text = fs.readFileSync(f, 'utf8');
              assert.ok(text.indexOf('KEY123') > 0 && text.indexOf('good') < 0 && text.indexOf('a@b.co') < 0, 'the key only');
              assert.strictEqual((fs.statSync(f).mode & 0o777).toString(8), '640');
              resolve();
            });
          });
        });
      });
    }).then(function () {
      return ok('an expired session is forgotten and said so; the email and password are checked before anything is sent', function () {
        return new Promise(function (resolve) {
          z.list(dir, function (err, r) {
            assert.ok(!err && r.items.length === 3 && !r.expired);
            fs.writeFileSync(path.join(dir, 'stremio.json'), JSON.stringify({authKey: 'OLD'}));
            z.list(dir, function (err2, r2) {
              assert.ok(!err2 && r2.expired && !z.loggedIn(dir), 'expired: forgotten');
              var before = sent.length;
              z.login(dir, 'not an email', 'x', function (e1) {
                z.login(dir, 'a@b.co', '', function (e2) {
                  assert.ok(e1 && e2 && sent.length === before, 'nothing sent');
                  resolve();
                });
              });
            });
          });
        });
      });
    }).then(function () {
      return ok('the page keeps no password and Continue watching merges Stremio with what was opened', function () {
        var js = fs.readFileSync(path.join(root, 'home', 'home.js'), 'utf8');
        assert.ok(/svcCall\('stremioLogin', \{email: email, password: password\}/.test(js) && /password = '';/.test(js), 'the password goes to the service and is dropped');
        assert.ok(!/localStorage\.setItem\([^)]*password/i.test(js) && !/Prefs\.set\('[^']*',\s*password/.test(js), 'it is never stored by the page');
        assert.ok(/local: 'stremio'/.test(js) && /p\.local === 'stremio'/.test(js), 'a card for each title, opening Stremio');
      });
    });
  })
  .then(function () {
    console.log('the first paint');
    return ok('the page sets its background before the styles load, and the text does not wait for the font', function () {
      var page = fs.readFileSync(path.join(root, 'home', 'index.html'), 'utf8'), css = fs.readFileSync(path.join(root, 'home', 'home.css'), 'utf8');
      assert.ok(page.indexOf('fmtv.boot') > 0 && page.indexOf('fmtv.boot') < page.indexOf('rel="stylesheet"'), 'the boot script comes first');
      assert.ok(/html\.boot-night[^{]*\{[^}]*background/.test(css), 'a night background for it');
      assert.ok(/font-display:\s*swap/.test(css), 'font-display: swap');
    });
  })
  .then(function () {
    return ok('the home is drawn from the saved list of apps, and again only when the TV answers something else', function () {
      var js = fs.readFileSync(path.join(root, 'home', 'home.js'), 'utf8');
      assert.ok(/function appsFromCache\(\)/.test(js) && /if \(drawnFromCache\) \{ renderAll\(\)/.test(js), 'drawn from the cache at the start');
      assert.ok(/if \(changed \|\| !drawnFromCache\) renderAll\(\)/.test(js), 'drawn again only on a change');
      assert.ok(!/loadApps\(function \(\) \{ renderShelf\(\); renderDrawer\(\); updateFocus\(\); Data\.refresh\(\)/.test(js), 'coming back does not rebuild the shelf every time');
    });
  })
  .then(function () {
    return ok('the RAM chip can be clicked: nothing hidden lies over it', function () {
      var css = fs.readFileSync(path.join(root, 'home', 'home.css'), 'utf8'), js = fs.readFileSync(path.join(root, 'home', 'home.js'), 'utf8');
      assert.ok(/\.round \.tip \{[^}]*pointer-events:\s*none/.test(css), 'the round buttons\' hidden names let the pointer through');
      assert.ok(/box\.onclick = function \(\) \{[^}]*openInfo\('memory'\)/.test(js), 'a click opens Memory');
      assert.ok(/st\.top >= TABS && st\.top < TABS \+ 3 && memShown\(\)/.test(js), 'down from the round buttons reaches it');
    });
  })
  .then(function () {
    console.log('\n' + passed + ' checks passed' + (process.exitCode ? ', some FAILED' : ''));
  });
