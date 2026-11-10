'use strict';
/*
 * What the person was watching on their own Jellyfin or Plex, for FreeTV's Continue watching: the server's own "resume" list, with how far
 * each title is. Both are asked with a token, never with a password stored:
 *
 *   jellyfinLogin(dir, server, user, password, done)   one sign-in at the person's own server (http or https); the password goes there once
 *                                                      and is not kept: state/jellyfin.json holds the address, the token and the user id (mode 640)
 *   plexStart(dir, done)                               asks plex.tv for a four-letter code (done(err, {id, code})): the person types it at plex.tv/link
 *   plexPoll(dir, id, done)                            done(err, {linked, name}): when linked, the account token and the server are kept (state/plex.json)
 *   logout(dir, kind)                                  forgets the token
 *   list(dir, done)                                    done(err, {items: [{src, id, name, type, poster, at, pct, ep, left}], expired: {jellyfin, plex}})
 *
 * Nothing else leaves the TV. Plain Node 8: http, https and JSON.
 */
var http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), crypto = require('crypto'), urlmod = require('url');

var request = function (method, url, headers, body, done) {
  var u = urlmod.parse(url), finished = false, mod = u.protocol === 'https:' ? https : http;
  function end(err, res) { if (!finished) { finished = true; done(err, res); } }
  var data = body ? JSON.stringify(body) : '';
  var h = {'Accept': 'application/json', 'User-Agent': 'FreeTV'};
  Object.keys(headers || {}).forEach(function (k) { h[k] = headers[k]; });
  if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
  var req = mod.request({protocol: u.protocol, hostname: u.hostname, port: u.port, path: u.path, method: method, headers: h, rejectUnauthorized: true}, function (res) {
    var parts = [], size = 0;
    res.on('data', function (d) { size += d.length; if (size <= 4 * 1024 * 1024) parts.push(d); else req.abort(); });
    res.on('end', function () {
      var json = null;
      try { json = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch (e) {}
      end(null, {status: res.statusCode, json: json});
    });
  });
  req.on('error', function (e) { end(e); });
  req.setTimeout(20000, function () { req.abort(); end(new Error('no answer in time')); });
  req.end(data || undefined);
};

function file(dir, kind) { return path.join(dir, kind + '.json'); }
function read(dir, kind) { try { return JSON.parse(fs.readFileSync(file(dir, kind), 'utf8')) || {}; } catch (e) { return {}; } }
function write(dir, kind, value) {
  fs.writeFileSync(file(dir, kind), JSON.stringify(value), {mode: parseInt('640', 8)});
  try { fs.chmodSync(file(dir, kind), parseInt('640', 8)); } catch (e) {}
}
function logout(dir, kind) {
  if (kind !== 'jellyfin' && kind !== 'plex') return;
  if (kind === 'plex') { var p = read(dir, 'plex'); if (p.clientId) { try { write(dir, 'plex', {clientId: p.clientId}); } catch (e) {} return; } }
  try { fs.unlinkSync(file(dir, kind)); } catch (e) {}
}
function loggedIn(dir, kind) { var j = read(dir, kind); return kind === 'jellyfin' ? !!(j.token && j.server) : !!(j.token && j.uri); }

function time(s) { var t = typeof s === 'number' ? s : Date.parse(s || ''); return t > 0 ? t : 0; }
function minutes(ms) { return ms > 0 ? Math.max(1, Math.round(ms / 60000)) : 0; }

// ---------------------------------------------------------------- Jellyfin

/** "192.168.1.5:8096", "http://nas:8096" or "https://jf.example.com/jellyfin" -> a clean base address ('' when it is none). */
function jfServer(text) {
  text = String(text || '').trim().replace(/\/+$/, '');
  if (!/^(https?:\/\/)?[A-Za-z0-9.-]+(:\d{2,5})?(\/[A-Za-z0-9._~\/-]*)?$/.test(text) || text.length > 200) return '';
  return /^https?:\/\//.test(text) ? text : 'http://' + text;
}

function jfAuth(deviceId, token) {
  return 'MediaBrowser Client="FreeTV", Device="LG TV", DeviceId="' + deviceId + '", Version="1"' + (token ? ', Token="' + token + '"' : '');
}

function jellyfinLogin(dir, server, user, password, done) {
  var base = jfServer(server);
  user = String(user || '').trim();
  password = String(password || '');
  if (!base) { done(new Error('server')); return; }
  if (!user || user.length > 100) { done(new Error('user')); return; }
  if (password.length > 300) { done(new Error('password')); return; }
  var deviceId = read(dir, 'jellyfin').deviceId || 'freetv-' + crypto.randomBytes(6).toString('hex');
  request('POST', base + '/Users/AuthenticateByName', {'X-Emby-Authorization': jfAuth(deviceId)}, {Username: user, Pw: password}, function (err, res) {
    password = '';
    if (err) { done(err); return; }
    if (res.status === 401 || res.status === 400) { done(new Error('refused')); return; }
    var j = res.json || {};
    if (res.status !== 200 || !j.AccessToken || !j.User || !j.User.Id) { done(new Error('The server did not answer like a Jellyfin (HTTP ' + res.status + ')')); return; }
    try { write(dir, 'jellyfin', {server: base, token: j.AccessToken, userId: j.User.Id, deviceId: deviceId, at: Date.now()}); } catch (e) { done(new Error('could not keep the session')); return; }
    done(null);
  });
}

/** The resume items of Jellyfin as FreeTV's cards (newest first, started and not finished). */
function jfPick(items, base) {
  var out = [];
  (items instanceof Array ? items : []).forEach(function (x) {
    if (!x || !x.Id || (x.Type !== 'Movie' && x.Type !== 'Episode')) return;
    var ud = x.UserData || {}, pos = (+ud.PlaybackPositionTicks || 0) / 10000, run = (+x.RunTimeTicks || 0) / 10000;
    if (pos <= 0) return;
    var pct = run > 0 ? Math.min(100, Math.round(pos / run * 100)) : Math.round(+ud.PlayedPercentage || 0);
    if (pct >= 95) return;
    var ep = x.Type === 'Episode' && x.ParentIndexNumber != null && x.IndexNumber != null ? 'T' + (+x.ParentIndexNumber) + ' · E' + (+x.IndexNumber) : '';
    var imgId = x.Type === 'Episode' && x.SeriesId ? x.SeriesId : x.Id, tag = x.Type === 'Episode' ? x.SeriesPrimaryImageTag : (x.ImageTags || {}).Primary;
    var poster = tag && /^[A-Za-z0-9]+$/.test(String(imgId)) && /^[A-Za-z0-9]+$/.test(String(tag)) ? base + '/Items/' + imgId + '/Images/Primary?maxHeight=450&quality=80&tag=' + tag : '';
    out.push({src: 'jellyfin', id: String(x.Id).slice(0, 40), name: String(x.Type === 'Episode' && x.SeriesName ? x.SeriesName : x.Name || '').slice(0, 80), type: x.Type === 'Episode' ? 'series' : 'movie',
      poster: poster, at: time(ud.LastPlayedDate), pct: pct, ep: ep, left: run > pos ? minutes(run - pos) : 0});
  });
  out.sort(function (a, b) { return b.at - a.at; });
  return out.filter(function (x) { return x.name; }).slice(0, 12);
}

function jellyfinList(dir, done) {
  var j = read(dir, 'jellyfin');
  if (!j.token || !j.server) { done(null, {items: [], expired: false}); return; }
  var url = j.server + '/Users/' + encodeURIComponent(j.userId) + '/Items/Resume?Limit=24&MediaTypes=Video&EnableUserData=true&EnableImageTypes=Primary&Fields=PrimaryImageAspectRatio';
  request('GET', url, {'X-Emby-Authorization': jfAuth(j.deviceId, j.token)}, null, function (err, res) {
    if (err) { done(err); return; }
    if (res.status === 401) { logout(dir, 'jellyfin'); done(null, {items: [], expired: true}); return; }
    if (res.status !== 200 || !res.json) { done(new Error('Jellyfin sent no list (HTTP ' + res.status + ')')); return; }
    done(null, {items: jfPick(res.json.Items, j.server), expired: false});
  });
}

// ---------------------------------------------------------------- Plex

function plexHeaders(clientId, token) {
  var h = {'X-Plex-Product': 'FreeTV', 'X-Plex-Version': '1', 'X-Plex-Platform': 'webOS', 'X-Plex-Device-Name': 'FreeTV', 'X-Plex-Client-Identifier': clientId};
  if (token) h['X-Plex-Token'] = token;
  return h;
}

function plexStart(dir, done) {
  var p = read(dir, 'plex'), clientId = p.clientId || 'freetv-' + crypto.randomBytes(8).toString('hex');
  try { write(dir, 'plex', {clientId: clientId, token: p.token, uri: p.uri, name: p.name, serverToken: p.serverToken}); } catch (e) {}
  request('POST', 'https://plex.tv/api/v2/pins?strong=false', plexHeaders(clientId), null, function (err, res) {
    if (err) { done(err); return; }
    var j = res.json || {};
    if (!j.id || !/^[A-Za-z0-9]{3,12}$/.test(String(j.code || ''))) { done(new Error('plex.tv did not give a code (HTTP ' + res.status + ')')); return; }
    done(null, {id: +j.id, code: String(j.code)});
  });
}

/** The server to ask: the account's first Plex Media Server, a local http address when there is one. */
function plexServer(devices, accountToken) {
  var best = null;
  (devices instanceof Array ? devices : []).forEach(function (d) {
    if (best || !d || !/server/.test(String(d.provides || '')) || !(d.connections instanceof Array)) return;
    var cons = d.connections.filter(function (c) { return c && typeof c.uri === 'string' && /^https?:\/\//.test(c.uri); });
    var pick = cons.filter(function (c) { return c.local && c.protocol === 'http'; })[0] || cons.filter(function (c) { return c.protocol === 'http'; })[0] || cons[0];
    if (pick) best = {uri: pick.uri.replace(/\/+$/, ''), name: String(d.name || 'Plex').slice(0, 60), serverToken: String(d.accessToken || accountToken)};
  });
  return best;
}

function plexPoll(dir, id, done) {
  var p = read(dir, 'plex');
  if (!p.clientId || !(+id > 0)) { done(new Error('no code')); return; }
  request('GET', 'https://plex.tv/api/v2/pins/' + (+id), plexHeaders(p.clientId), null, function (err, res) {
    if (err) { done(err); return; }
    var token = res.json && res.json.authToken;
    if (!token || typeof token !== 'string') { done(null, {linked: false}); return; }
    request('GET', 'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=0', plexHeaders(p.clientId, token), null, function (err2, r2) {
      if (err2) { done(err2); return; }
      var s = plexServer(r2.json, token);
      if (!s) { done(new Error('There is no Plex Media Server on that account')); return; }
      try { write(dir, 'plex', {clientId: p.clientId, token: token, uri: s.uri, name: s.name, serverToken: s.serverToken, at: Date.now()}); } catch (e) { done(new Error('could not keep the session')); return; }
      done(null, {linked: true, name: s.name});
    });
  });
}

function plexPick(meta, p) {
  var out = [];
  (meta instanceof Array ? meta : []).forEach(function (x) {
    if (!x || !x.ratingKey || (x.type !== 'movie' && x.type !== 'episode')) return;
    var pos = +x.viewOffset || 0, run = +x.duration || 0;
    if (pos <= 0) return;   // up next, not started
    var pct = run > 0 ? Math.min(100, Math.round(pos / run * 100)) : 0;
    if (pct >= 95) return;
    var thumb = x.type === 'episode' ? x.grandparentThumb || x.thumb : x.thumb, ep = x.type === 'episode' && x.parentIndex != null && x.index != null ? 'T' + (+x.parentIndex) + ' · E' + (+x.index) : '';
    out.push({src: 'plex', id: String(x.ratingKey).slice(0, 40), name: String(x.type === 'episode' && x.grandparentTitle ? x.grandparentTitle : x.title || '').slice(0, 80), type: x.type === 'episode' ? 'series' : 'movie',
      poster: typeof thumb === 'string' && /^\/[A-Za-z0-9\/_.:-]+$/.test(thumb) ? p.uri + thumb + '?X-Plex-Token=' + p.serverToken : '', at: (+x.lastViewedAt || 0) * 1000, pct: pct, ep: ep, left: run > pos ? minutes(run - pos) : 0});
  });
  out.sort(function (a, b) { return b.at - a.at; });
  return out.filter(function (x) { return x.name; }).slice(0, 12);
}

function plexList(dir, done) {
  var p = read(dir, 'plex');
  if (!p.token || !p.uri) { done(null, {items: [], expired: false}); return; }
  var h = plexHeaders(p.clientId, p.serverToken);
  request('GET', p.uri + '/hubs/continueWatching/items?count=24', h, null, function (err, res) {
    if (err) { done(err); return; }
    if (res.status === 401) { logout(dir, 'plex'); done(null, {items: [], expired: true}); return; }
    function finish(r) {
      var meta = r && r.json && r.json.MediaContainer && r.json.MediaContainer.Metadata;
      done(null, {items: plexPick(meta, p), expired: false});
    }
    if (res.status === 404 || !res.json) {   // an older server: "on deck" is its list
      request('GET', p.uri + '/library/onDeck', h, null, function (e2, r2) { if (e2) { done(e2); return; } if (r2.status === 401) { logout(dir, 'plex'); done(null, {items: [], expired: true}); return; } finish(r2); });
      return;
    }
    finish(res);
  });
}

/** Both lists together, newest first; one that fails does not take the other with it. */
function list(dir, done) {
  var items = [], expired = {jellyfin: false, plex: false}, errors = [], pending = 0, answered = false;
  function one(kind, fn) {
    if (!loggedIn(dir, kind)) return;
    pending++;
    fn(dir, function (err, r) {
      if (err) errors.push(kind + ': ' + (err.message || err));
      else { items = items.concat(r.items); expired[kind] = !!r.expired; }
      if (--pending === 0 && !answered) { answered = true; items.sort(function (a, b) { return b.at - a.at; }); done(errors.length && !items.length ? new Error(errors.join('; ')) : null, {items: items.slice(0, 24), expired: expired, errors: errors}); }
    });
  }
  one('jellyfin', jellyfinList);
  one('plex', plexList);
  if (!pending) done(null, {items: [], expired: expired, errors: []});
}

module.exports = {jellyfinLogin: jellyfinLogin, plexStart: plexStart, plexPoll: plexPoll, logout: logout, loggedIn: loggedIn, list: list,
  jfPick: jfPick, plexPick: plexPick, plexServer: plexServer, jfServer: jfServer, setRequest: function (fn) { request = fn; }};
