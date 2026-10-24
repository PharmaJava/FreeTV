'use strict';
/*
 * Looks YouTube channels up for the Custom tab, from the TV itself (the screen cannot: YouTube's pages have no CORS). Used by
 * service.js ("channels"). Plain Node 8: https and regular expressions over the public pages, no key and no account.
 *
 *   search('bluey', done)      -> done(null, [{id: 'UC…', title, thumb, subs, latest}])   (up to 6, channels only)
 *   search('@BlueyOfficialChannel' or a youtube.com/… address, done) -> that one channel
 */
var https = require('https');

var CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
var HEADERS = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) FreeTV', 'Accept-Language': 'en-US,en;q=0.9', 'Cookie': 'CONSENT=YES+1; SOCS=CAI'};
var LIVE = '🔴';   // the red circle YouTube channels put in the title of a live stream

function get(url, done, hops) {
  var options = require('url').parse(url);   // Node 8 (the TV's) has no https.get(url, options, callback)
  options.headers = HEADERS;
  var req = https.get(options, function (res) {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (hops || 0) < 4) {
      res.resume();
      get(require('url').resolve(url, res.headers.location), done, (hops || 0) + 1);
      return;
    }
    if (res.statusCode !== 200) { res.resume(); done(new Error('YouTube answered ' + res.statusCode)); return; }
    var parts = [], size = 0;
    res.on('data', function (d) {
      size += d.length;
      if (size < 4 * 1024 * 1024) parts.push(d);
    });
    res.on('end', function () { done(null, Buffer.concat(parts).toString('utf8')); });
  });
  req.on('error', done);
  req.setTimeout(20000, function () { req.abort(); });
}

/** The JSON object that starts at text[at] ("{"), cut by counting braces outside strings. */
function objectAt(text, at) {
  var depth = 0, inString = false, i;
  for (i = at; i < text.length; i++) {
    var c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(text.slice(at, i + 1)); } catch (e) { return null; }
    }
  }
  return null;
}

function text(t) {
  if (!t) return '';
  if (t.simpleText) return t.simpleText;
  return (t.runs || []).map(function (r) { return r.text; }).join('');
}

function bigThumb(list) {
  var url = list && list.length ? list[list.length - 1].url : '';
  if (url && url.indexOf('//') === 0) url = 'https:' + url;
  return url.replace(/=s\d+[^/]*$/, '=s512-c-k-c0x00ffffff-no-rj');
}

function meta(html, prop) {
  var m = new RegExp('<meta[^>]+property="' + prop + '"[^>]+content="([^"]*)"').exec(html);
  return m ? m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"') : '';
}

/** The channel's newest video that plays now (its RSS feed), or ''. A live stream (marked with the red circle) or a premiere that has
    not started (0 views) does not open in YouTube's TV screen, so those are skipped. */
function latest(id, done) {
  get('https://www.youtube.com/feeds/videos.xml?channel_id=' + id, function (err, xml) {
    var entries = (!err && xml || '').split('<entry>').slice(1), i;
    for (i = 0; i < entries.length; i++) {
      var vid = /<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/.exec(entries[i]);
      var views = /<media:statistics views="(\d+)"/.exec(entries[i]);
      var title = /<title>([\s\S]*?)<\/title>/.exec(entries[i]);
      if (vid && views && +views[1] > 0 && (title ? title[1] : '').indexOf(LIVE) < 0) { done(vid[1]); return; }
    }
    done('');
  });
}

function withLatest(list, done) {
  var left = list.length;
  if (!left) { done(null, list); return; }
  list.forEach(function (c) {
    latest(c.id, function (v) {
      c.latest = v;
      if (--left === 0) done(null, list);
    });
  });
}

/** One channel's page (@handle, /channel/UC…, /c/…): its id, name and picture. */
function channelPage(url, done) {
  get(url, function (err, html) {
    if (err) { done(err); return; }
    var m = /<link rel="canonical" href="https?:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/.exec(html) ||
      /"(?:externalId|channelId)":"(UC[A-Za-z0-9_-]{22})"/.exec(html);
    if (!m) { done(new Error('No encuentro ese canal.')); return; }
    withLatest([{id: m[1], title: meta(html, 'og:title'), thumb: bigThumb([{url: meta(html, 'og:image')}]), subs: ''}], done);
  });
}

function search(query, done) {
  query = String(query || '').trim().slice(0, 100);
  if (!query) { done(new Error('Escribe un nombre.')); return; }
  var address = /^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/((?:@|channel\/|c\/|user\/)[^\s?#]+)/i.exec(query);
  if (address) { channelPage('https://www.youtube.com/' + address[1], done); return; }
  if (/^@[A-Za-z0-9._-]{3,60}$/.test(query)) { channelPage('https://www.youtube.com/' + query, done); return; }
  if (CHANNEL_ID.test(query)) { channelPage('https://www.youtube.com/channel/' + query, done); return; }
  // sp=EgIQAg%3D%3D: channels only
  get('https://www.youtube.com/results?sp=EgIQAg%253D%253D&search_query=' + encodeURIComponent(query), function (err, html) {
    if (err) { done(err); return; }
    var out = [], seen = {}, at = 0;
    while (out.length < 6 && (at = html.indexOf('"channelRenderer":{', at)) >= 0) {
      at += '"channelRenderer":'.length;
      var c = objectAt(html, at);
      if (!c || !CHANNEL_ID.test(c.channelId || '') || seen[c.channelId]) continue;
      seen[c.channelId] = true;
      out.push({id: c.channelId, title: text(c.title), thumb: bigThumb(c.thumbnail && c.thumbnail.thumbnails),
                subs: text(c.videoCountText) || text(c.subscriberCountText)});
    }
    if (!out.length) { done(new Error('YouTube no ha dado ningún canal con ese nombre.')); return; }
    withLatest(out, done);
  });
}

module.exports = {search: search, latest: latest};
