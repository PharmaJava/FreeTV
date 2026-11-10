'use strict';
/*
 * What the person was watching in Stremio (Stremio Origin, or any Stremio), for FreeTV's Continue watching: the library of their own Stremio
 * account, asked of Stremio's own API (api.strem.io) with a session key.
 *
 *   login(dir, email, password, done)   asks Stremio for a session key and keeps ONLY that key (state/stremio.json, mode 640); the
 *                                       password goes to Stremio once and is not kept, logged or written anywhere
 *   logout(dir)                         forgets the key
 *   loggedIn(dir)                       is there a key?
 *   list(dir, done)                     done(err, {items: [{id, name, type, poster, at, pct, ep, left}], expired})   newest first
 *
 * Nothing else leaves the TV and nothing is sent but what Stremio's own apps send. Plain Node 8: https and JSON.
 */
var https = require('https'), fs = require('fs'), path = require('path');

var HOST = 'api.strem.io';
var post = function (method, body, done) {
  var data = JSON.stringify(body), finished = false;
  function end(err, json) { if (!finished) { finished = true; done(err, json); } }
  var req = https.request({host: HOST, path: '/api/' + method, method: 'POST', headers: {
    'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'User-Agent': 'FreeTV', 'Accept': 'application/json'}}, function (res) {
    var parts = [], size = 0;
    res.on('data', function (d) { size += d.length; if (size <= 8 * 1024 * 1024) parts.push(d); else req.abort(); });
    res.on('end', function () {
      var json = null;
      try { json = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch (e) {}
      if (!json) end(new Error('Stremio did not answer in a way I understand (HTTP ' + res.statusCode + ')'));
      else end(null, json);
    });
  });
  req.on('error', function (e) { end(e); });
  req.setTimeout(20000, function () { req.abort(); end(new Error('Stremio did not answer in time')); });
  req.end(data);
};

function file(dir) { return path.join(dir, 'stremio.json'); }

function readKey(dir) {
  try { var j = JSON.parse(fs.readFileSync(file(dir), 'utf8')); return typeof j.authKey === 'string' && j.authKey ? j.authKey : ''; } catch (e) { return ''; }
}

function loggedIn(dir) { return !!readKey(dir); }

function logout(dir) { try { fs.unlinkSync(file(dir)); } catch (e) {} }

function errorText(json) {
  var e = json && json.error;
  return e ? String(e.message || e) : '';
}

function login(dir, email, password, done) {
  email = String(email || '').trim();
  password = String(password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) { done(new Error('email')); return; }
  if (!password || password.length > 300) { done(new Error('password')); return; }
  post('login', {type: 'Login', email: email, password: password, facebook: false}, function (err, json) {
    password = '';
    if (err) { done(err); return; }
    var key = json.result && json.result.authKey;
    if (!key || typeof key !== 'string') { done(new Error(errorText(json) || 'Stremio refused the login')); return; }
    try {
      fs.writeFileSync(file(dir), JSON.stringify({authKey: key, at: Date.now()}), {mode: parseInt('640', 8)});
      try { fs.chmodSync(file(dir), parseInt('640', 8)); } catch (e) {}
    } catch (e) { done(new Error('could not keep the session')); return; }
    done(null);
  });
}

function time(s) { var t = typeof s === 'number' ? s : Date.parse(s || ''); return t > 0 ? t : 0; }

/** The library items that are being watched, newest first: [{id, name, type, poster, at, pct, ep, left}] (at most 12). */
function pick(list) {
  var out = [];
  (list instanceof Array ? list : []).forEach(function (x) {
    // Stremio's own rule: a title is in Continue watching when it is not removed, or when it is only "temp" (watched without being added to the library:
    // what most people watch). Dropping temp ones hid nearly everything.
    if (!x || (x.removed && !x.temp) || !x._id || !x.name) return;
    if (x.type !== 'movie' && x.type !== 'series') return;
    var s = x.state || {}, offset = +s.timeOffset || 0, at = time(s.lastWatched) || time(x._mtime);
    if (offset <= 0 || !at) return;   // not started (or only saved in the library)
    var dur = +s.duration || 0, pct = dur > 0 ? Math.min(100, Math.round(offset / dur * 100)) : 0;
    if (pct >= 95) return;   // finished
    var ep = '', m = /:(\d+):(\d+)$/.exec(String(s.video_id || ''));
    if (m && x.type === 'series') ep = 'T' + (+m[1]) + ' · E' + (+m[2]);
    var left = dur > offset ? Math.max(1, Math.round((dur - offset) / 60000)) : 0;   // minutes still to watch
    out.push({id: String(x._id).slice(0, 40), name: String(x.name).slice(0, 80), type: x.type,
      poster: /^https:\/\//.test(x.poster || '') ? String(x.poster).slice(0, 300) : '', at: at, pct: pct, ep: ep, left: left});
  });
  out.sort(function (a, b) { return b.at - a.at; });
  return out.slice(0, 12);
}

function list(dir, done) {
  var key = readKey(dir);
  if (!key) { done(new Error('no session')); return; }
  post('datastoreGet', {authKey: key, collection: 'libraryItem', ids: [], all: true}, function (err, json) {
    if (err) { done(err); return; }
    if (!(json.result instanceof Array)) {
      var why = errorText(json);
      if (/session|auth|key/i.test(why)) { logout(dir); done(null, {items: [], expired: true}); return; }
      done(new Error(why || 'Stremio sent no library')); return;
    }
    done(null, {items: pick(json.result), expired: false});
  });
}

module.exports = {login: login, logout: logout, loggedIn: loggedIn, list: list, pick: pick, setPost: function (fn) { post = fn; }};
