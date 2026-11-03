'use strict';
/*
 * FreeTV updating itself from its own GitHub releases (the TV's side of Home Settings → Maintenance → FreeTV updates).
 *
 *   latest(repo, done)  -> done(err, {version, tag, notes, ipkUrl, sumsUrl, size, at})   the newest release that has a FreeTV package
 *
 * Whose releases: state/update-repo.txt ("owner/name"), else PharmaJava/FreeTV. A fork that wants its own TVs to follow it writes its
 * name there. What it accepts: a release of that repository, whose package (FreeTV-webos*.ipk) and SHA256SUMS are on
 * github.com/<owner>/<name>/releases/download/. The download and the SHA-256 check are done in store.js (selfUpdate).
 * Plain Node 8: https and JSON.
 */
var https = require('https'), fs = require('fs'), path = require('path');

var DEFAULT_REPO = 'PharmaJava/FreeTV';
var REPO_RE = /^[A-Za-z0-9_.-]{1,60}\/[A-Za-z0-9_.-]{1,100}$/;

/** The repository whose releases this TV follows. */
function repo(dir) {
  try {
    var r = fs.readFileSync(path.join(dir, 'update-repo.txt'), 'utf8').trim();
    if (REPO_RE.test(r)) return r;
  } catch (e) {}
  return DEFAULT_REPO;
}

function getJson(url, done) {
  var options = require('url').parse(url);   // Node 8 has no https.get(url, options, callback)
  options.headers = {'User-Agent': 'FreeTV-updater', 'Accept': 'application/vnd.github+json'};
  var req = https.get(options, function (res) {
    var parts = [], size = 0;
    if (res.statusCode !== 200) { res.resume(); done(new Error('GitHub answered ' + res.statusCode)); return; }
    res.on('data', function (d) { size += d.length; if (size < 1024 * 1024) parts.push(d); });
    res.on('end', function () {
      var json = null;
      try { json = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch (e) { done(e); return; }
      done(null, json);
    });
  });
  req.on('error', done);
  req.setTimeout(20000, function () { req.abort(); });
}

/** What a release says, or null when it is not a release with a FreeTV package of this repository. */
function describe(rel, repoName) {
  if (!rel || typeof rel.tag_name !== 'string' || rel.draft || rel.prerelease) return null;
  var version = rel.tag_name.replace(/^v/i, '');
  if (!/^\d+(\.\d+){1,3}$/.test(version)) return null;
  var base = 'https://github.com/' + repoName + '/releases/download/' + rel.tag_name + '/', ipk = null, sums = null;
  (rel.assets || []).forEach(function (a) {
    if (!a || typeof a.name !== 'string' || typeof a.browser_download_url !== 'string') return;
    if (a.browser_download_url.indexOf(base) !== 0 || !/^[A-Za-z0-9._-]+$/.test(a.name)) return;
    if (/^FreeTV-webos.*\.ipk$/i.test(a.name)) ipk = a;
    else if (a.name === 'SHA256SUMS') sums = a;
  });
  if (!ipk || !sums) return null;
  return {version: version, tag: rel.tag_name, notes: String(rel.body || '').replace(/\r/g, '').slice(0, 700), ipkName: ipk.name, ipkUrl: ipk.browser_download_url,
    sumsUrl: sums.browser_download_url, size: ipk.size || 0, at: rel.published_at || ''};
}

function latest(repoName, done) {
  getJson('https://api.github.com/repos/' + repoName + '/releases/latest', function (err, rel) {
    if (err) { done(err); return; }
    var d = describe(rel, repoName);
    if (!d) { done(new Error('The latest release has no FreeTV package for LG.')); return; }
    done(null, d);
  });
}

/** 2.1.0 vs 2.1: true when a is newer than b. */
function isNewer(a, b) {
  var x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (var i = 0; i < Math.max(x.length, y.length); i++) {
    var p = x[i] || 0, q = y[i] || 0;
    if (p !== q) return p > q;
  }
  return false;
}

module.exports = {repo: repo, latest: latest, describe: describe, isNewer: isNewer, DEFAULT_REPO: DEFAULT_REPO};
