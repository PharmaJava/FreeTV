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
    console.log('\n' + passed + ' checks passed' + (process.exitCode ? ', some FAILED' : ''));
  });
