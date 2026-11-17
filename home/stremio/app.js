/*
 * Stremio Claude for Samsung (Tizen): the web version of our Stremio, inside FreeTV's package (Samsung TVs only run web apps).
 * Your Stremio account (linked with a QR code, as on LG) and your own addons: Home, Movies, Series, Search, Library, titles with
 * their episodes, sources from your addons, subtitles, and Continue watching kept in your account.
 * Direct links play in the TV's own player. A Samsung web app cannot open torrent connections itself, so torrents go through an engine
 * running as a TizenBrew service on this TV (tizenbrew-torrent/, started from here, with the person's yes) or through a Stremio streaming
 * server on the network (Settings), whichever is set. Plain ES5 (the TV may run Chrome 56), no libraries. Remote control only.
 */
(function () {
  'use strict';
  var API = 'https://api.strem.io/api/', LINK = 'https://link.stremio.com/api/';
  var CINEMETA = 'https://v3-cinemeta.strem.io';
  var MODULE = 'gh/PharmaJava/FreeTV@v2.17.0/tizenbrew-torrent', LOCAL = 'http://127.0.0.1:11470';   // the torrent engine, as a TizenBrew module
  var BREW_APP = 'xvvl3S1bvH.TizenBrewStandalone', BREW_WS = 'ws://127.0.0.1:8081';
  var BREW = {GetModules: 4, StartService: 6, Error: 8, ModuleAction: 10};   // TizenBrew's service events

  // ---- small helpers ------------------------------------------------------------------------------------------------
  var LANG = (function () {
    var l = (window.CONFIG && window.CONFIG.language && window.CONFIG.language !== 'auto') ? window.CONFIG.language : (navigator.language || 'en');
    l = String(l).slice(0, 2).toLowerCase();
    return l === 'es' || l === 'pt' ? l : 'en';
  })();
  function T(es, en, pt) { return LANG === 'es' ? es : LANG === 'pt' ? (pt || en) : en; }
  var store = {
    get: function (k) { try { return window.localStorage.getItem('sc.' + k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v === null || v === undefined) window.localStorage.removeItem('sc.' + k); else window.localStorage.setItem('sc.' + k, String(v)); } catch (e) {} },
    json: function (k) { try { return JSON.parse(window.localStorage.getItem('sc.' + k)); } catch (e) { return null; } }
  };
  function enc(s) { return encodeURIComponent(s); }
  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function empty(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function $(id) { return document.getElementById(id); }
  function cssUrl(u) {
    return 'url("' + String(u).replace(/["\\\n\r()]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); }) + '")';
  }
  function num(x) { return typeof x === 'number' && isFinite(x) ? x : 0; }

  /** JSON over XHR: cb(err, json, text). The package's access-origin setting lets a Samsung web app reach any address. */
  function http(method, url, body, cb, timeout) {
    var done = false;
    var x = new XMLHttpRequest();
    function fin(err, j, t) { if (done) return; done = true; cb(err, j, t); }
    try { x.open(method, url, true); } catch (e) { setTimeout(function () { fin({status: 0}); }, 0); return x; }
    x.timeout = timeout || 15000;
    if (body !== undefined && body !== null) x.setRequestHeader('Content-Type', 'application/json');
    x.onload = function () {
      var j = null;
      try { j = JSON.parse(x.responseText); } catch (e) {}
      fin(x.status >= 200 && x.status < 300 ? null : {status: x.status}, j, x.responseText);
    };
    x.onerror = x.ontimeout = function () { fin({status: 0}, null, ''); };
    x.send(body === undefined || body === null ? null : JSON.stringify(body));
    return x;
  }
  var memo = {};   // addon answers kept while the app is open
  function getJson(url, cb) {
    if (memo[url]) { setTimeout(function () { cb(null, memo[url]); }, 0); return; }
    http('GET', url, null, function (err, j) {
      if (!err && j) memo[url] = j;
      cb(err, j);
    });
  }
  function api(name, body, cb) {
    http('POST', API + name, body, function (err, j) {
      if (err || !j) { cb(err || {status: 0}, null); return; }
      if (j.error) { cb({status: 200, message: j.error.message || String(j.error)}, null); return; }
      cb(null, j.result);
    });
  }

  // ---- account, addons, library -------------------------------------------------------------------------------------
  var S = {authKey: store.get('authKey'), user: store.json('user'), addons: [], lib: {}, libLoaded: false};
  var DEFAULT_ADDON = {
    transportUrl: CINEMETA + '/manifest.json', transportName: 'http',
    manifest: {
      id: 'com.linvo.cinemeta', name: 'Cinemeta', types: ['movie', 'series'], idPrefixes: ['tt'],
      resources: ['catalog', 'meta'],
      catalogs: [
        {type: 'movie', id: 'top', name: 'Popular', extra: [{name: 'genre'}, {name: 'skip'}, {name: 'search'}]},
        {type: 'series', id: 'top', name: 'Popular', extra: [{name: 'genre'}, {name: 'skip'}, {name: 'search'}]},
        {type: 'movie', id: 'imdbRating', name: 'Top Rated', extra: [{name: 'genre'}, {name: 'skip'}]},
        {type: 'series', id: 'imdbRating', name: 'Top Rated', extra: [{name: 'genre'}, {name: 'skip'}]}
      ]
    }
  };
  function addonBase(a) { return String(a.transportUrl || '').replace(/\/manifest\.json(\?.*)?$/, ''); }
  function addonName(a) { return (a.manifest && a.manifest.name) || a.transportName || ''; }

  function loadAddons(cb) {
    function use(list) { S.addons = list && list.length ? list : [DEFAULT_ADDON]; cb(); }
    if (!S.authKey) { use(null); return; }
    api('addonCollectionGet', {authKey: S.authKey, update: true}, function (err, r) {
      var list = r && r.addons && r.addons.length ? r.addons : null;
      if (list) store.set('addons', JSON.stringify(list));
      else list = store.json('addons');
      use(list);
    });
  }
  function loadLibrary(cb) {
    if (!S.authKey) { S.lib = {}; S.libLoaded = true; cb(); return; }
    api('datastoreGet', {authKey: S.authKey, collection: 'libraryItem', ids: [], all: true}, function (err, r) {
      if (!err && r && r.length !== undefined) {
        S.lib = {};
        for (var i = 0; i < r.length; i++) if (r[i] && r[i]._id) S.lib[r[i]._id] = r[i];
        S.libLoaded = true;
      }
      cb();
    });
  }
  function nowIso() { return new Date().toISOString(); }
  function libPut(item) {
    item._mtime = nowIso();
    S.lib[item._id] = item;
    if (S.authKey) api('datastorePut', {authKey: S.authKey, collection: 'libraryItem', changes: [item]}, function () {});
  }
  function libItem(meta) {
    var l = S.lib[meta.id];
    if (l) return l;
    return {
      _id: meta.id, name: meta.name || '', type: meta.type || 'movie', poster: meta.poster || '', posterShape: 'poster',
      background: meta.background || '', logo: meta.logo || '', year: '', removed: true, temp: true, _ctime: nowIso(), _mtime: nowIso(),
      state: {lastWatched: nowIso(), timeWatched: 0, timeOffset: 0, overallTimeWatched: 0, timesWatched: 0, flaggedWatched: 0, duration: 0, video_id: '', watched: '', noNotif: false},
      behaviorHints: {}
    };
  }
  function inLibrary(id) { var l = S.lib[id]; return !!l && !l.removed; }
  function toggleLibrary(meta) {
    var l = libItem(meta);
    if (inLibrary(meta.id)) l.removed = true;
    else { l.removed = false; l.temp = false; l.name = meta.name || l.name; l.poster = meta.poster || l.poster; l.background = meta.background || l.background; l.logo = meta.logo || l.logo; l.year = meta.releaseInfo || meta.year || l.year || ''; }
    libPut(l);
  }
  function resumeOf(id) {
    var l = S.lib[id], s = l && l.state;
    if (!s || !(s.timeOffset > 0) || !(s.duration > 0) || s.timeOffset > s.duration * 0.96) return null;
    return {videoId: s.video_id || id, ms: s.timeOffset, of: s.duration};
  }

  // ---- addon queries ------------------------------------------------------------------------------------------------
  function hasRes(m, res, type, id) {
    var rs = (m && m.resources) || [], i, j;
    for (i = 0; i < rs.length; i++) {
      var r = rs[i], name = typeof r === 'string' ? r : r.name;
      if (name !== res) continue;
      var types = (typeof r === 'object' && r.types) || m.types || [];
      var pre = (typeof r === 'object' && r.idPrefixes) || m.idPrefixes;
      if (types.length && type && types.indexOf(type) < 0) continue;
      if (pre && pre.length && id) {
        var ok = false;
        for (j = 0; j < pre.length; j++) if (String(id).indexOf(pre[j]) === 0) ok = true;
        if (!ok) continue;
      }
      return true;
    }
    return false;
  }
  /** What a catalog needs asked with nothing chosen ("" if nothing, "genre=Action" for a required option), or null when it needs a search. */
  function catExtra(c) {
    var extra = c.extra || [], req = {}, out = [], i, n;
    for (i = 0; i < extra.length; i++) if (extra[i].isRequired) req[extra[i].name] = true;
    var er = c.extraRequired || [];
    for (i = 0; i < er.length; i++) req[er[i]] = true;
    for (n in req) {
      if (!req.hasOwnProperty(n)) continue;
      var e = null;
      for (i = 0; i < extra.length; i++) if (extra[i].name === n) e = extra[i];
      if (e && e.options && e.options.length) out.push(n + '=' + enc(e.options[0]));
      else return null;
    }
    return out.join('&');
  }
  function catSearchable(c) {
    var extra = c.extra || [], i;
    for (i = 0; i < extra.length; i++) if (extra[i].name === 'search') return true;
    var es = c.extraSupported || [];
    for (i = 0; i < es.length; i++) if (es[i] === 'search') return true;
    return false;
  }
  function catTitle(c, a) {
    var nm = c.name || c.id || '', t = c.type;
    var suf = t === 'movie' ? T('Películas', 'Movies', 'Filmes') : t === 'series' ? T('Series', 'Series', 'Séries') : '';
    return suf ? nm + ' · ' + suf : nm;
  }
  /** Every catalog the addons offer: [{title, type, url, searchBase}] ; kind: 'home' | 'movie' | 'series'. */
  function catalogs(kind) {
    var out = [], i, j;
    for (i = 0; i < S.addons.length; i++) {
      var a = S.addons[i], m = a.manifest || {}, cats = m.catalogs || [], base = addonBase(a);
      for (j = 0; j < cats.length; j++) {
        var c = cats[j];
        if (!c.type || !c.id) continue;
        if (kind !== 'home' && c.type !== kind) continue;
        var ex = catExtra(c);
        if (ex === null) continue;
        out.push({title: catTitle(c, a), type: c.type, url: base + '/catalog/' + enc(c.type) + '/' + enc(c.id) + (ex ? '/' + ex : '') + '.json', key: a.transportUrl + c.type + c.id});
      }
    }
    return out;
  }
  function searchCatalogs() {
    var out = [], i, j;
    for (i = 0; i < S.addons.length; i++) {
      var a = S.addons[i], m = a.manifest || {}, cats = m.catalogs || [], base = addonBase(a);
      for (j = 0; j < cats.length; j++) {
        var c = cats[j];
        if (!c.type || !c.id || !catSearchable(c)) continue;
        out.push({title: catTitle(c, a), type: c.type, url: base + '/catalog/' + enc(c.type) + '/' + enc(c.id) + '/search=' + '{q}' + '.json', key: a.transportUrl + c.type + c.id});
      }
    }
    return out;
  }
  function addonsFor(res, type, id) {
    var out = [], i;
    for (i = 0; i < S.addons.length; i++) if (hasRes(S.addons[i].manifest, res, type, id)) out.push(S.addons[i]);
    return out;
  }
  function metaOf(type, id, cb) {
    var list = addonsFor('meta', type, id);
    if (!list.length) list = [DEFAULT_ADDON];
    var i = 0;
    (function next() {
      if (i >= list.length) { cb(null); return; }
      var a = list[i++];
      getJson(addonBase(a) + '/meta/' + enc(type) + '/' + enc(id) + '.json', function (err, j) {
        if (!err && j && j.meta && j.meta.id) cb(j.meta); else next();
      });
    })();
  }

  // ---- screen manager and focus -------------------------------------------------------------------------------------
  var view = $('view'), navBox = $('nav'), cur = null, stack = [], here = null, token = 0, playing = null, wantKey = null;
  var TABS = [['home', T('Inicio', 'Home', 'Início')], ['movie', T('Películas', 'Movies', 'Filmes')], ['series', T('Series', 'Series', 'Séries')],
              ['search', T('Buscar', 'Search', 'Pesquisar')], ['lib', T('Biblioteca', 'Library', 'Biblioteca')], ['set', T('Ajustes', 'Settings', 'Definições')]];

  function toast(text, ms) {
    var t = $('toast');
    t.textContent = text;
    t.style.display = 'block';
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { t.style.display = 'none'; }, ms || 3200);
  }
  function setFocus(el) {
    if (cur) cur.className = cur.className.replace(/ ?\bon\b/g, '');
    cur = el;
    if (!el) return;
    el.className += ' on';
    reveal(el);
    if (el.getAttribute('data-hover')) { /* reserved */ }
  }
  function reveal(el) {
    var strip = el.parentNode;
    if (strip && /\bstrip\b/.test(strip.className)) {
      var cr = strip.getBoundingClientRect(), er = el.getBoundingClientRect();
      if (er.left < cr.left + 60) strip.scrollLeft -= cr.left + 60 - er.left;
      else if (er.right > cr.right - 60) strip.scrollLeft += er.right - cr.right + 60;
    }
    if (el.closest && el.closest('#view')) {
      var box = (el.closest('.rowbox') || el), vr = view.getBoundingClientRect(), br = box.getBoundingClientRect(), er2 = el.getBoundingClientRect();
      var top = Math.min(br.top, er2.top), bottom = Math.max(Math.min(br.bottom, er2.top + 700), er2.bottom);
      if (top < vr.top + 10) view.scrollTop -= vr.top + 10 - top;
      else if (bottom > vr.bottom - 30) view.scrollTop += bottom - vr.bottom + 30;
    }
  }
  function visible(el) { return el.offsetWidth > 0 && el.offsetHeight > 0; }
  function move(dir) {
    if (!cur) { var f = firstFocus(); if (f) setFocus(f); return; }
    var all = document.querySelectorAll('.f'), r = cur.getBoundingClientRect(), best = null, bs = 1e9, i;
    var cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    for (i = 0; i < all.length; i++) {
      var c = all[i];
      if (c === cur || !visible(c) || (c.closest && c.closest('#player') && !playing)) continue;
      var q = c.getBoundingClientRect(), qx = (q.left + q.right) / 2, qy = (q.top + q.bottom) / 2, prim, sec;
      if (dir === 'right') { if (q.left < r.right - r.width * 0.5 && qx <= cx) continue; prim = q.left - r.right; if (qx <= cx) continue; sec = Math.max(0, Math.max(r.top - q.bottom, q.top - r.bottom)) + Math.abs(qy - cy) * 0.25; }
      else if (dir === 'left') { if (qx >= cx) continue; prim = r.left - q.right; sec = Math.max(0, Math.max(r.top - q.bottom, q.top - r.bottom)) + Math.abs(qy - cy) * 0.25; }
      else if (dir === 'down') { if (qy <= cy || q.top < r.top + r.height * 0.4) continue; prim = q.top - r.bottom; sec = Math.max(0, Math.max(r.left - q.right, q.left - r.right)) + Math.abs(qx - cx) * 0.5; }
      else { if (qy >= cy || q.bottom > r.bottom - r.height * 0.4) continue; prim = r.top - q.bottom; sec = Math.max(0, Math.max(r.left - q.right, q.left - r.right)) + Math.abs(qx - cx) * 0.5; }
      if (prim < 0) prim = 0;
      var score = prim + sec * 3;
      if (score < bs) { bs = score; best = c; }
    }
    if (best) setFocus(best);
  }
  function firstFocus() {
    var f = view.querySelector('.f');
    return f || navBox.querySelector('.f');
  }
  function focusKey(k) {
    if (!k) return null;
    var all = document.querySelectorAll('#view .f'), i;
    for (i = 0; i < all.length; i++) if (all[i].getAttribute('data-k') === k) return all[i];
    return null;
  }
  function fk(el, k) { el.setAttribute('data-k', k); return el; }

  /** go('home', {...}): shows a screen and remembers the one that was there (Back returns to it, where the focus was). */
  function go(name, args, replace) {
    if (here && !replace) {
      here.k = cur && cur.getAttribute('data-k');
      here.scroll = view.scrollTop;
      stack.push(here);
    }
    show({name: name, args: args || {}});
  }
  function show(s, restore) {
    token++;
    here = s;
    cur = null;
    empty(view);
    view.scrollTop = 0;
    var main = s.name === 'home' || s.name === 'movie' || s.name === 'series' || s.name === 'search' || s.name === 'lib' || s.name === 'set';
    document.body.className = main ? '' : 'nonav';
    if (main) drawNav(s.name);
    var mine = token;
    var fn = SCREENS[s.name];
    fn(s.args, view, mine);
    wantKey = restore ? s.k : null;   // screens that fill in later (the sources) put the focus back there when it exists
    var f = restore ? focusKey(s.k) : null;
    if (restore && s.scroll) view.scrollTop = s.scroll;
    f = f || firstFocus();
    if (f) setFocus(f);
  }
  function back() {
    if (!stack.length) { leave(); return; }
    var s = stack.pop();
    show(s, true);
  }
  function leave() { window.location.href = '../index.html'; }

  function drawNav(name) {
    empty(navBox);
    var logo = h('div', 'logo');
    logo.innerHTML = 'Stremio <b>Claude</b>';
    navBox.appendChild(logo);
    TABS.forEach(function (t) {
      var e = fk(h('div', 'tab f' + (t[0] === name ? ' cur' : ''), t[1]), 'tab:' + t[0]);
      e.onclick = function () { tab(t[0]); };
      e.act = function () { tab(t[0]); };
      navBox.appendChild(e);
    });
    var who = h('div', 'who', S.user && S.user.email ? S.user.email : (S.authKey ? '' : T('Sin cuenta', 'No account', 'Sem conta')));
    navBox.appendChild(who);
  }
  function tab(name) {
    stack = [];
    here = null;
    go(name, {}, true);
    var t = navBox.querySelector('.tab.cur');
    if (t) setFocus(t);
  }

  // ---- cards and rows -----------------------------------------------------------------------------------------------
  function card(it, k, opts) {
    var shape = it.posterShape === 'landscape' ? ' land' : it.posterShape === 'square' ? ' sq' : '';
    var e = fk(h('div', 'card f' + shape), k);
    var pic = h('div', 'pic');
    var img = it.poster || it.background || it.logo || '';
    if (img) pic.style.backgroundImage = cssUrl(img);
    else pic.appendChild(h('div', 'noimg', it.name || ''));
    if (opts && opts.progress > 0) { var b = h('div', 'bar'), i = h('i'); i.style.width = Math.min(100, Math.round(opts.progress * 100)) + '%'; b.appendChild(i); pic.appendChild(b); }
    e.appendChild(pic);
    e.appendChild(h('div', 'cap', it.name || ''));
    e.act = function () { go('detail', {type: it.type, id: it.id, item: it, resume: opts && opts.resume}); };
    return e;
  }
  /** A row of titles, filled when its catalog answers (and left out when it has nothing). */
  var queue = [], busy = 0;
  function pump() {
    while (busy < 4 && queue.length) { busy++; queue.shift()(); }
  }
  function enqueue(job) { queue.push(job); pump(); }
  function addRow(parent, def, mine) {
    var box = h('div', 'rowbox'), strip = h('div', 'strip');
    box.appendChild(h('h2', '', def.title));
    box.appendChild(strip);
    box.style.display = 'none';
    parent.appendChild(box);
    enqueue(function () {
      getJson(def.url, function (err, j) {
        busy--; pump();
        if (mine !== token) return;
        var metas = j && j.metas;
        if (!metas || !metas.length) { if (box.parentNode) box.parentNode.removeChild(box); return; }
        box.style.display = '';
        for (var i = 0; i < metas.length && i < 30; i++) {
          if (!metas[i].id) continue;
          if (!metas[i].type) metas[i].type = def.type;
          strip.appendChild(card(metas[i], 'c:' + def.key + ':' + metas[i].id));
        }
        if (!cur) { var f = firstFocus(); if (f) setFocus(f); }
      });
    });
    return box;
  }
  function continueItems() {
    var out = [], id;
    for (id in S.lib) {
      if (!S.lib.hasOwnProperty(id)) continue;
      var l = S.lib[id], s = l.state || {};
      if (l.removed && l.temp && !(s.timeOffset > 0)) continue;
      if (!(s.timeOffset > 0) || l.type === 'other') continue;
      if (s.duration > 0 && s.timeOffset > s.duration * 0.96) continue;
      out.push(l);
    }
    out.sort(function (a, b) { return String(b.state.lastWatched || b._mtime || '') < String(a.state.lastWatched || a._mtime || '') ? -1 : 1; });
    return out.slice(0, 20);
  }

  // ---- screens ------------------------------------------------------------------------------------------------------
  var SCREENS = {};

  function catalogPage(kind) {
    return function (args, root, mine) {
      var page = h('div', 'page');
      root.appendChild(page);
      if (kind === 'home') {
        var cw = continueItems();
        if (cw.length) {
          var box = h('div', 'rowbox'), strip = h('div', 'strip');
          box.appendChild(h('h2', '', T('Continuar viendo', 'Continue watching', 'Continuar a ver')));
          box.appendChild(strip);
          cw.forEach(function (l) {
            var it = {id: l._id, type: l.type, name: l.name, poster: l.poster, posterShape: l.posterShape};
            strip.appendChild(card(it, 'cw:' + l._id, {progress: l.state.timeOffset / l.state.duration, resume: true}));
          });
          page.appendChild(box);
        }
      }
      var defs = catalogs(kind);
      if (!defs.length) { page.appendChild(h('div', 'empty', T('Tus addons no ofrecen catálogos.', 'Your addons offer no catalogues.', 'Os seus addons não têm catálogos.'))); return; }
      defs.slice(0, kind === 'home' ? 24 : 40).forEach(function (d) { addRow(page, d, mine); });
    };
  }
  SCREENS.home = catalogPage('home');
  SCREENS.movie = catalogPage('movie');
  SCREENS.series = catalogPage('series');

  SCREENS.search = function (args, root, mine) {
    var wrap = h('div', 'page');
    var sb = h('div', 'sbox'), box = fk(h('div', 'in f'), 'q'), input = h('input');
    input.type = 'text';
    input.value = args.q || '';
    input.setAttribute('placeholder', T('Escribe una película o serie…', 'Type a film or series…', 'Escreva um filme ou série…'));
    box.appendChild(input);
    sb.appendChild(box);
    var results = h('div');
    wrap.appendChild(sb);
    wrap.appendChild(results);
    root.appendChild(wrap);
    function run() {
      var q = input.value.replace(/^\s+|\s+$/g, '');
      here.args.q = q;
      empty(results);
      if (!q) return;
      var defs = searchCatalogs();
      if (!defs.length) { results.appendChild(h('div', 'empty', T('Tus addons no tienen búsqueda.', 'Your addons have no search.', 'Os seus addons não têm pesquisa.'))); return; }
      token++;
      var mine2 = token;
      defs.forEach(function (d) {
        addRow(results, {title: d.title, type: d.type, key: d.key, url: d.url.replace('{q}', enc(q))}, mine2);
      });
    }
    box.act = function () { input.focus(); };
    input.onkeydown = function (e) {
      if (e.keyCode === 13 || e.keyCode === 65376 || e.keyCode === 65385) { e.stopPropagation(); input.blur(); run(); }
      else if (e.keyCode === 10009 || e.keyCode === 27) { e.stopPropagation(); input.blur(); }
      else e.stopPropagation();
    };
    input.onchange = function () { run(); };
    if (args.q) run();
  };

  SCREENS.lib = function (args, root) {
    var page = h('div', 'page'), grid = h('div', 'grid'), id, items = [];
    root.appendChild(page);
    if (!S.authKey) { page.appendChild(h('div', 'empty', T('Entra en tu cuenta de Stremio (en Ajustes) para ver tu biblioteca.', 'Sign in to your Stremio account (in Settings) to see your library.', 'Entre na sua conta Stremio (em Definições) para ver a biblioteca.'))); return; }
    for (id in S.lib) if (S.lib.hasOwnProperty(id) && !S.lib[id].removed && S.lib[id].type !== 'other') items.push(S.lib[id]);
    items.sort(function (a, b) { return String(b._mtime || '') < String(a._mtime || '') ? -1 : 1; });
    if (!items.length) { page.appendChild(h('div', 'empty', T('Tu biblioteca está vacía. Añade títulos con «Añadir a la biblioteca».', 'Your library is empty. Add titles with “Add to library”.', 'A biblioteca está vazia.'))); return; }
    items.forEach(function (l) {
      var s = l.state || {};
      grid.appendChild(card({id: l._id, type: l.type, name: l.name, poster: l.poster, posterShape: l.posterShape}, 'lib:' + l._id,
        {progress: s.duration > 0 && s.timeOffset > 0 && s.timeOffset < s.duration * 0.96 ? s.timeOffset / s.duration : 0}));
    });
    page.appendChild(grid);
  };

  var SUBLANGS = [['spa', 'Español'], ['eng', 'English'], ['por', 'Português'], ['fre', 'Français'], ['ger', 'Deutsch'], ['ita', 'Italiano'], ['off', T('Sin subtítulos', 'Off', 'Sem legendas')]];
  function subLangName(code) {
    var i;
    for (i = 0; i < SUBLANGS.length; i++) if (SUBLANGS[i][0] === code) return SUBLANGS[i][1];
    return code;
  }
  function subPref() { return store.get('sublang') || (LANG === 'es' ? 'spa' : LANG === 'pt' ? 'por' : 'eng'); }
  function serverUrl() {
    var u = (store.get('server') || '').replace(/^\s+|\s+$/g, '');
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
    return u.replace(/\/+$/, '');
  }

  SCREENS.set = function (args, root) {
    var page = h('div', 'set');
    root.appendChild(page);
    function line(key, title, hint, value, act) {
      var r = fk(h('div', 'row f'), key), k = h('div', 'k', title);
      if (hint) k.appendChild(h('small', '', hint));
      r.appendChild(k);
      var v = h('div', 'v', value || '');
      r.appendChild(v);
      r.act = act;
      page.appendChild(r);
      return {row: r, value: v};
    }
    line('acc', S.authKey ? T('Cuenta de Stremio', 'Stremio account', 'Conta Stremio') : T('Entrar en Stremio', 'Sign in to Stremio', 'Entrar no Stremio'),
      S.authKey ? T('Pulsa OK para cerrar la sesión', 'Press OK to sign out', 'OK para sair') : T('Con el código QR, desde el móvil', 'With the QR code, from your phone', 'Com o código QR, do telemóvel'),
      S.authKey ? (S.user && S.user.email || '') : '',
      function () {
        if (S.authKey) {
          api('logout', {authKey: S.authKey}, function () {});
          S.authKey = null; S.user = null; S.lib = {}; memo = {};
          store.set('authKey', null); store.set('user', null); store.set('addons', null); store.set('guest', null);
          loadAddons(function () { go('login', {}, true); });
        } else { store.set('guest', null); go('login', {}, true); }
      });
    var sl = line('sub', T('Idioma de los subtítulos', 'Subtitle language', 'Idioma das legendas'), T('Se activa solo si el addon lo ofrece', 'Turns on by itself if the addon has it', ''), subLangName(subPref()), function () {
      var i, p = subPref(), n = 0;
      for (i = 0; i < SUBLANGS.length; i++) if (SUBLANGS[i][0] === p) n = i;
      n = (n + 1) % SUBLANGS.length;
      store.set('sublang', SUBLANGS[n][0]);
      sl.value.textContent = SUBLANGS[n][1];
    });
    var en = line('eng', T('Torrents en esta tele (TizenBrew)', 'Torrents on this TV (TizenBrew)', 'Torrents nesta TV (TizenBrew)'),
      T('Módulo «Stremio Claude Torrents»: se añade a TizenBrew y se arranca al elegir un torrent', 'The “Stremio Claude Torrents” module: added to TizenBrew and started when you pick a torrent', 'Módulo para TizenBrew'),
      store.get('engine') === '1' ? T('Sí', 'On', 'Sim') : T('No', 'Off', 'Não'), function () {
        var on = store.get('engine') === '1';
        store.set('engine', on ? null : '1');
        en.value.textContent = on ? T('No', 'Off', 'Não') : T('Sí', 'On', 'Sim');
        toast(on ? T('Torrents de la tele desactivados', 'This TV’s torrents are off', 'Desativado') : T('Se arrancarán al elegir un torrent', 'They start when you pick a torrent', 'Arrancam ao escolher um torrent'));
      });
    var sv = line('srv', T('Servidor de torrents de tu red (Stremio Server)', 'Torrent server on your network (Stremio Server)', 'Servidor de torrents da rede (Stremio Server)'),
      T('Opcional, por ejemplo 192.168.1.20:11470. Si lo escribes se usa en vez del módulo de la tele.', 'Optional, like 192.168.1.20:11470. If set, it is used instead of the TV module.', 'Opcional. Se preenchido, usa-se em vez do módulo.'), '', null);
    var inp = h('input');
    inp.type = 'text';
    inp.value = store.get('server') || '';
    inp.setAttribute('placeholder', 'http://192.168.1.20:11470');
    sv.value.appendChild(inp);
    sv.value.style.width = '520px';
    sv.row.act = function () { inp.focus(); };
    inp.onkeydown = function (e) {
      e.stopPropagation();
      if (e.keyCode === 13 || e.keyCode === 10009 || e.keyCode === 27 || e.keyCode === 65376) { store.set('server', inp.value); inp.blur(); toast(inp.value ? T('Servidor guardado', 'Server saved', 'Servidor guardado') : T('Servidor quitado', 'Server removed', 'Servidor removido')); }
    };
    inp.onchange = function () { store.set('server', inp.value); };
    var ad = line('addons', T('Tus addons', 'Your addons', 'Os seus addons'), T('Se gestionan desde tu cuenta, en stremio.com o en la app del móvil', 'Managed from your account, on stremio.com or in the phone app', ''),
      String(S.addons.length), function () { toast(S.addons.map(addonName).join(' · '), 6000); });
    line('back', T('Volver a FreeTV', 'Back to FreeTV', 'Voltar ao FreeTV'), '', '', leave);
    line('ver', 'Stremio Claude ' + (window.CONFIG && window.CONFIG.version ? '· FreeTV ' + window.CONFIG.version : ''), 'github.com/PharmaJava/webos', '', function () {});
    void ad;
  };

  SCREENS.login = function (args, root, mine) {
    var box = h('div', 'login'), l = h('div', 'l'), r = h('div', 'r');
    l.appendChild(h('h1', '', T('Entra con tu móvil', 'Sign in with your phone', 'Entre com o telemóvel')));
    l.appendChild(h('p', '', T('Escanea el código con la cámara y entra en tu cuenta de Stremio.', 'Scan the code with your camera and sign in to your Stremio account.', 'Leia o código com a câmara e entre na sua conta Stremio.')));
    var canvas = h('canvas'), code = h('div', 'code', '…'), url = h('div', 'url', '');
    l.appendChild(canvas); l.appendChild(code); l.appendChild(url);
    r.appendChild(h('h1', '', T('Sin cuenta', 'No account', 'Sem conta')));
    r.appendChild(h('p', '', T('Puedes mirar los catálogos de Cinemeta ahora y entrar más tarde. Con tu cuenta tendrás tus addons y tu biblioteca.', 'You can browse Cinemeta’s catalogues now and sign in later. With your account you get your addons and library.', 'Pode ver os catálogos do Cinemeta e entrar depois.')));
    var guest = fk(h('div', 'btn f', T('Continuar sin cuenta', 'Continue without an account', 'Continuar sem conta')), 'guest');
    guest.act = function () { token++; store.set('guest', '1'); start(); };
    r.appendChild(guest);
    box.appendChild(l); box.appendChild(r);
    root.appendChild(box);
    function poll(c) {
      if (mine !== token) return;
      setTimeout(function () {
        if (mine !== token) return;
        http('GET', LINK + 'read?code=' + enc(c), null, function (err, j) {
          if (mine !== token) return;
          var ak = j && j.result && (j.result.authKey || j.result.auth_key);
          if (ak) { signedIn(ak); return; }
          poll(c);
        });
      }, 2500);
    }
    http('GET', LINK + 'create', null, function (err, j) {
      if (mine !== token) return;
      var c = j && (j.code || (j.result && j.result.code)), link = j && (j.link || (j.result && j.result.link));
      if (!c) { code.textContent = ''; url.textContent = T('No se pudo conseguir el código. Revisa la conexión.', 'Could not get a code. Check the connection.', 'Sem código. Verifique a ligação.'); return; }
      link = link || ('https://link.stremio.com/' + c);
      code.textContent = c;
      url.textContent = link.replace(/^https?:\/\//, '');
      if (window.QR && window.QR.draw) { try { window.QR.draw(canvas, link, 8); } catch (e) {} }
      poll(c);
    });
  };

  // ---- title page ---------------------------------------------------------------------------------------------------
  function episodes(meta) {
    var v = (meta.videos || []).filter(function (x) { return x && x.id; }), i;
    for (i = 0; i < v.length; i++) { v[i].season = num(v[i].season); v[i].ep = num(v[i].episode || v[i].number); }
    v.sort(function (a, b) {
      var sa = a.season === 0 ? 1e6 : a.season, sb = b.season === 0 ? 1e6 : b.season;
      return sa !== sb ? sa - sb : a.ep - b.ep;
    });
    return v;
  }
  function epLabel(v) { return (v.season ? 'S' + v.season + ' ' : '') + 'E' + v.ep; }

  SCREENS.detail = function (args, root, mine) {
    var type = args.type, id = args.id, item = args.item || {};
    var page = h('div', 'page'), hero = h('div', 'hero'), tail = h('div');
    root.appendChild(page);
    page.appendChild(hero); page.appendChild(tail);
    if (item.background || item.poster) hero.style.backgroundImage = cssUrl(item.background || item.poster);
    hero.appendChild(h('h1', '', item.name || ''));
    hero.appendChild(h('div', 'facts', '…'));
    metaOf(type, id, function (meta) {
      if (mine !== token) return;
      empty(hero);
      if (!meta) { hero.appendChild(h('h1', '', item.name || id)); hero.appendChild(h('div', 'desc', T('No se pudo cargar la ficha de este título.', 'Could not load this title.', 'Não foi possível carregar o título.'))); var b0 = fk(h('div', 'btn f', T('Atrás', 'Back', 'Voltar')), 'b'); b0.act = back; var bx = h('div', 'btns'); bx.appendChild(b0); hero.appendChild(bx); setFocus(b0); return; }
      meta.type = meta.type || type;
      if (meta.background) hero.style.backgroundImage = cssUrl(meta.background);
      if (meta.logo) { var lg = h('img', 'logo'); lg.src = meta.logo; lg.onerror = function () { lg.style.display = 'none'; }; hero.appendChild(lg); }
      hero.appendChild(h('h1', '', meta.name || item.name || ''));
      var facts = h('div', 'facts'), parts = [];
      if (meta.imdbRating) parts.push('<b>★ ' + meta.imdbRating + '</b>');
      if (meta.releaseInfo || meta.year) parts.push(meta.releaseInfo || meta.year);
      if (meta.runtime) parts.push(meta.runtime);
      if (meta.genres && meta.genres.length) parts.push(meta.genres.slice(0, 3).join(', '));
      facts.innerHTML = parts.join('  ·  ').replace(/<(?!\/?b>)/g, '&lt;');
      hero.appendChild(facts);
      if (meta.description) hero.appendChild(h('div', 'desc', meta.description));
      var btns = h('div', 'btns'), eps = meta.type === 'series' || (meta.videos && meta.videos.length > 1) ? episodes(meta) : [];
      var res = resumeOf(id), playBtn;
      function play(vid, label, ms) { go('streams', {type: meta.type, id: id, videoId: vid, title: label, meta: meta, resume: ms || 0}); }
      if (!eps.length) {
        playBtn = fk(h('div', 'btn main f', res ? T('Continuar', 'Resume', 'Continuar') : T('Ver ahora', 'Watch now', 'Ver agora')), 'play');
        playBtn.act = function () { play(id, meta.name, res ? res.ms : 0); };
      } else {
        var target = eps[0], ms = 0, i;
        if (res) for (i = 0; i < eps.length; i++) if (eps[i].id === res.videoId) { target = eps[i]; ms = res.ms; }
        playBtn = fk(h('div', 'btn main f', (ms ? T('Continuar ', 'Resume ', 'Continuar ') : T('Ver ', 'Watch ', 'Ver ')) + epLabel(target)), 'play');
        playBtn.act = function () { play(target.id, meta.name + ' · ' + epLabel(target), ms); };
      }
      btns.appendChild(playBtn);
      var libBtn = fk(h('div', 'btn f'), 'lib');
      function libText() { libBtn.textContent = inLibrary(id) ? T('✓ En la biblioteca', '✓ In library', '✓ Na biblioteca') : T('+ Añadir a la biblioteca', '+ Add to library', '+ Adicionar à biblioteca'); }
      libText();
      libBtn.act = function () {
        if (!S.authKey) { toast(T('Entra en tu cuenta (Ajustes) para usar la biblioteca', 'Sign in (Settings) to use the library', 'Entre na conta (Definições)')); return; }
        toggleLibrary(meta); libText();
      };
      btns.appendChild(libBtn);
      hero.appendChild(btns);
      if (eps.length) drawEpisodes(tail, meta, eps, res, play, mine);
      setFocus(playBtn);
    });
  };

  function drawEpisodes(tail, meta, eps, res, play, mine) {
    var seasons = [], i;
    for (i = 0; i < eps.length; i++) if (seasons.indexOf(eps[i].season) < 0) seasons.push(eps[i].season);
    var chips = h('div', 'chips'), list = h('div', 'eps'), season = seasons[0];
    var l = S.lib[meta.id], vid = l && l.state && l.state.video_id;
    for (i = 0; i < eps.length; i++) if (eps[i].id === vid) season = eps[i].season;
    if (seasons.indexOf(1) >= 0 && !vid) season = 1;
    tail.appendChild(chips); tail.appendChild(list);
    function draw() {
      empty(chips); empty(list);
      if (seasons.length > 1) seasons.forEach(function (sn) {
        var c = fk(h('div', 'chip f' + (sn === season ? ' cur' : ''), sn === 0 ? T('Especiales', 'Specials', 'Especiais') : T('Temporada ', 'Season ', 'Temporada ') + sn), 'sn:' + sn);
        c.act = function () { season = sn; draw(); var f = focusKey('sn:' + sn); if (f) setFocus(f); };
        chips.appendChild(c);
      });
      eps.forEach(function (v) {
        if (v.season !== season) return;
        var e = fk(h('div', 'ep f'), 'ep:' + v.id), th = h('div', 'th'), tx = h('div', 'tx');
        if (v.thumbnail) th.style.backgroundImage = cssUrl(v.thumbnail);
        e.appendChild(th);
        tx.appendChild(h('div', 'n', v.ep + '. ' + (v.title || v.name || T('Episodio ', 'Episode ', 'Episódio ') + v.ep)));
        if (v.overview || v.description) tx.appendChild(h('div', 'd', v.overview || v.description));
        e.appendChild(tx);
        if (res && res.videoId === v.id) { var b = h('div', 'bar'), ii = h('i'); ii.style.width = Math.round(100 * res.ms / res.of) + '%'; b.appendChild(ii); e.appendChild(b); }
        e.act = function () { play(v.id, meta.name + ' · ' + epLabel(v), res && res.videoId === v.id ? res.ms : 0); };
        list.appendChild(e);
      });
    }
    draw();
    void mine;
  }

  // ---- sources ------------------------------------------------------------------------------------------------------
  function streamKind(s) {
    if (s.url && /^https?:/i.test(s.url)) return 'url';
    if (s.infoHash) return 'torrent';
    return '';
  }
  SCREENS.streams = function (args, root, mine) {
    var type = args.type, vid = args.videoId;
    var head = h('div', 'head', args.title || ''), sub = h('div', 'sub', T('Buscando fuentes en tus addons…', 'Looking for sources in your addons…', 'A procurar fontes…'));
    var list = h('div', 'list');
    root.appendChild(head); root.appendChild(sub); root.appendChild(list);
    var addons = addonsFor('stream', type, vid), got = 0, total = addons.length, groups = [], found = 0;
    if (!total) { sub.textContent = T('Ninguno de tus addons ofrece fuentes para este título.', 'None of your addons offers sources for this title.', 'Nenhum addon tem fontes.'); var bb = fk(h('div', 'btn f', T('Atrás', 'Back', 'Voltar')), 'b'); bb.act = back; list.appendChild(bb); setFocus(bb); return; }
    function row(a, s) {
      var kind = streamKind(s), r = fk(h('div', 'src f'), 's:' + found++);
      r.appendChild(h('div', 'a', addonName(a)));
      var m = h('div', 'm');
      m.appendChild(h('div', 'nm', String(s.name || s.title || '').replace(/\n+/g, ' · ')));
      var ds = s.description || (s.name && s.title) || '';
      if (ds) m.appendChild(h('div', 'ds', String(ds)));
      r.appendChild(m);
      r.appendChild(h('div', 'tag', kind === 'torrent' ? 'Torrent' : kind === 'url' ? T('Directo', 'Direct', 'Direto') : T('No disponible', 'Unavailable', 'Indisponível')));
      r.act = function () {
        if (!kind) { toast(T('Esta fuente se abre fuera de la tele (YouTube o una web). Elige otra.', 'This source opens outside the TV (YouTube or a website). Pick another.', 'Esta fonte abre fora da TV.')); return; }
        playStream(s, args, kind);
      };
      return r;
    }
    function place(r, idx) {
      // keep the addons' order: a group per addon
      var g = groups[idx];
      g.appendChild(r);
    }
    addons.forEach(function (a, idx) {
      var g = h('div'); groups[idx] = g; list.appendChild(g);
      getJson(addonBase(a) + '/stream/' + enc(type) + '/' + enc(vid) + '.json', function (err, j) {
        got++;
        if (mine !== token) return;
        var ss = (j && j.streams) || [], i;
        for (i = 0; i < ss.length; i++) if (ss[i] && (streamKind(ss[i]) || ss[i].externalUrl || ss[i].ytId)) place(row(a, ss[i]), idx);
        sub.textContent = found ? (found + ' ' + T('fuentes', 'sources', 'fontes') + (got < total ? ' · ' + T('buscando…', 'searching…', 'a procurar…') : '')) :
          (got < total ? T('Buscando fuentes en tus addons…', 'Looking for sources in your addons…', 'A procurar fontes…') : T('No hay fuentes para este título.', 'No sources for this title.', 'Sem fontes.'));
        var wf = wantKey && focusKey(wantKey);
        if (wf) { setFocus(wf); wantKey = null; }
        else if (!wantKey && (!cur || !/\bsrc\b/.test(cur.className))) { var f = list.querySelector('.f'); if (f) setFocus(f); }
      });
    });
  };

  function playStream(s, ctx, kind) {
    if (kind === 'url') { openPlayer(s.url, s, ctx); return; }
    withEngine(function (base) {
      var ih = String(s.infoHash).toLowerCase(), sources = (s.sources || []).slice(), i;
      sources.push('dht:' + ih);
      var body = {torrent: {infoHash: ih}, peerSearch: {sources: sources, min: 40, max: 150}};
      if (typeof s.fileIdx !== 'number') body.guessFileIdx = {}; else body.fileIdx = s.fileIdx;
      toast(T('Preparando el torrent…', 'Preparing the torrent…', 'A preparar o torrent…'), 100000);
      http('POST', base + '/' + ih + '/create', body, function (err, j) {
        $('toast').style.display = 'none';
        if (err) {
          var why = j && j.error ? String(j.error) : '';
          if (err.status === 504) toast(T('Nadie respondió con este torrent (sin pares). Prueba otra fuente.', 'Nobody answered for this torrent (no peers). Try another source.', 'Sem pares para este torrent. Tente outra fonte.'), 6000);
          else if (err.status === 507) toast(why || T('No hay sitio libre en la tele para este torrent.', 'Not enough free space on the TV for this torrent.', 'Sem espaço livre na TV.'), 8000);
          else toast(T('No se pudo preparar el torrent', 'Could not prepare the torrent', 'Não foi possível preparar o torrent') + (why ? ': ' + why : ' (' + base + ')'), 6000);
          return;
        }
        var idx = typeof s.fileIdx === 'number' ? s.fileIdx : (j && typeof j.guessedFileIdx === 'number' ? j.guessedFileIdx : -1);
        if (idx < 0 && j && j.files && j.files.length) {
          var best = -1, size = -1;
          for (i = 0; i < j.files.length; i++) {
            var f = j.files[i];
            if (/\.(mkv|mp4|avi|mov|m4v|webm|ts)$/i.test(f.name || f.path || '') && num(f.length) > size) { size = num(f.length); best = i; }
          }
          idx = best;
        }
        if (idx < 0) idx = 0;
        openPlayer(base + '/' + ih + '/' + idx, s, ctx);
      }, 120000);
    }, function () { playStream(s, ctx, kind); });
  }

  // ---- the torrent engine ---------------------------------------------------------------------------------------------------------
  function probe(base, cb) {
    http('GET', base + '/status', null, function (err, j) { cb(!err && !!j && j.ok === true); }, 2500);
  }
  /** Asks TizenBrew's service (ws://127.0.0.1:8081) to add our module and start its service; cb(null) when asked, or a reason. */
  function startLocal(cb) {
    var ws, done = false, timer;
    function fin(reason) { if (done) return; done = true; clearTimeout(timer); try { ws.close(); } catch (e) {} cb(reason); }
    try { ws = new WebSocket(BREW_WS); } catch (e) { setTimeout(function () { cb('nobrew'); }, 0); return; }
    timer = setTimeout(function () { fin('nobrew'); }, 5000);
    ws.onerror = function () { fin('nobrew'); };
    ws.onopen = function () {
      clearTimeout(timer);
      timer = setTimeout(function () { fin('module'); }, 25000);
      ws.send(JSON.stringify({type: BREW.ModuleAction, payload: {action: 'add', module: MODULE}}));
      setTimeout(function () { try { ws.send(JSON.stringify({type: BREW.GetModules, payload: true})); } catch (e) { fin('nobrew'); } }, 300);
    };
    ws.onmessage = function (e) {
      var m;
      try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.type === BREW.Error) { fin('module'); return; }
      if (m.type !== BREW.GetModules || !m.payload) return;
      var mod = null, i;
      for (i = 0; i < m.payload.length; i++) if (m.payload[i].fullName === MODULE) mod = m.payload[i];
      if (!mod || !mod.serviceFile) { fin('module'); return; }
      ws.send(JSON.stringify({type: BREW.StartService, payload: mod}));
      setTimeout(function () { fin(null); }, 400);
    };
  }
  /** The torrent engine's address: a Stremio server typed in Settings, or the engine on this TV (started when needed). */
  function withEngine(cb, again) {
    var srv = serverUrl();
    if (srv) { cb(srv); return; }
    if (store.get('engine') !== '1') {
      go('ask', {title: T('Torrents en esta tele', 'Torrents on this TV', 'Torrents nesta TV'),
        text: T('Una app web de Samsung no puede abrir torrents por sí sola. FreeTV puede añadir a TizenBrew un módulo, «Stremio Claude Torrents» (código en github.com/PharmaJava/FreeTV, carpeta tizenbrew-torrent), que se ejecuta solo en esta tele, descarga únicamente el torrent que elijas y borra sus datos al cambiar de torrent. Necesita TizenBrew instalado y abierto desde que se encendió la tele, y sitio libre en la tele (el tamaño del vídeo).',
          'A Samsung web app cannot open torrents by itself. FreeTV can add a module to TizenBrew, “Stremio Claude Torrents” (code at github.com/PharmaJava/FreeTV, folder tizenbrew-torrent), which runs only on this TV, downloads only the torrent you pick and removes its data when you pick another. It needs TizenBrew installed and opened since the TV was switched on, and free space on the TV (the size of the video).',
          'Uma app web da Samsung não abre torrents sozinha. O FreeTV pode adicionar ao TizenBrew o módulo «Stremio Claude Torrents» (código em github.com/PharmaJava/FreeTV), que corre só nesta TV. Precisa do TizenBrew aberto e de espaço livre.'),
        buttons: [{label: T('Activar torrents', 'Turn torrents on', 'Ativar torrents'), act: function () { store.set('engine', '1'); back(); setTimeout(again, 50); }},
                  {label: T('Ahora no', 'Not now', 'Agora não'), act: back}]});
      return;
    }
    toast(T('Arrancando los torrents de esta tele…', 'Starting this TV’s torrents…', 'A iniciar os torrents…'), 60000);
    probe(LOCAL, function (up) {
      if (up) { $('toast').style.display = 'none'; cb(LOCAL); return; }
      startLocal(function (reason) {
        if (reason) { $('toast').style.display = 'none'; engineProblem(reason); return; }
        var tries = 0;
        (function wait() {
          probe(LOCAL, function (ok) {
            if (ok) { $('toast').style.display = 'none'; cb(LOCAL); return; }
            if (++tries > 40) { $('toast').style.display = 'none'; engineProblem('slow'); return; }
            setTimeout(wait, 1000);
          });
        })();
      });
    });
  }
  function openBrew() {
    try { window.tizen.application.launch(BREW_APP, function () {}, function () { toast(T('TizenBrew no está instalado en esta tele', 'TizenBrew is not installed on this TV', 'O TizenBrew não está instalado')); }); } catch (e) { toast(T('No se pudo abrir TizenBrew', 'Could not open TizenBrew', 'Não foi possível abrir o TizenBrew')); }
  }
  function engineProblem(reason) {
    var nobrew = reason === 'nobrew';
    go('ask', {title: nobrew ? T('TizenBrew no responde', 'TizenBrew does not answer', 'O TizenBrew não responde') : T('El motor de torrents no arrancó', 'The torrent engine did not start', 'O motor de torrents não arrancou'),
      text: nobrew
        ? T('Los torrents de esta tele necesitan TizenBrew (gratis, de la comunidad) instalado y abierto al menos una vez desde que se encendió la tele. Ábrelo, vuelve a FreeTV (botón Home → Apps) y prueba otra vez. Si no lo tienes, la guía para instalarlo está en la web de FreeTV. También puedes escribir en Ajustes la dirección de un Stremio Server de tu red.',
            'This TV’s torrents need TizenBrew (free, from the community) installed and opened at least once since the TV was switched on. Open it, come back to FreeTV (Home button → Apps) and try again. If you do not have it, the install guide is on FreeTV’s website. You can also type the address of a Stremio Server on your network in Settings.',
            'Os torrents desta TV precisam do TizenBrew instalado e aberto uma vez desde que ligou a TV. Abra-o, volte ao FreeTV e tente de novo.')
        : T('TizenBrew está abierto, pero el módulo de torrents no llegó a arrancar. Suele ser la conexión a internet de la tele (el módulo se descarga de jsdelivr) o una tele cuyo TizenBrew trae un Node demasiado antiguo. Inténtalo otra vez en un momento, o usa un Stremio Server de tu red (Ajustes).',
            'TizenBrew is open, but the torrent module did not start. It is usually the TV’s internet connection (the module comes from jsdelivr) or a TV whose TizenBrew has a Node that is too old. Try again in a moment, or use a Stremio Server on your network (Settings).',
            'O módulo de torrents não arrancou. Verifique a internet da TV ou use um Stremio Server (Definições).'),
      buttons: (nobrew ? [{label: T('Abrir TizenBrew', 'Open TizenBrew', 'Abrir TizenBrew'), act: openBrew}] : []).concat([{label: T('Atrás', 'Back', 'Voltar'), act: back}])});
  }
  SCREENS.ask = function (args, root) {
    var box = h('div', 'login'), col = h('div', 'r');
    col.style.width = '1100px'; col.style.padding = '0';
    col.appendChild(h('h1', '', args.title));
    var p = h('p', '', args.text);
    p.style.textAlign = 'left';
    col.appendChild(p);
    var first = null;
    (args.buttons || []).forEach(function (b, i) {
      var e = fk(h('div', 'btn f' + (i === 0 ? ' main' : ''), b.label), 'ask:' + i);
      e.act = b.act;
      col.appendChild(e);
      if (!first) first = e;
    });
    box.appendChild(col);
    root.appendChild(box);
  };

  // ---- player -------------------------------------------------------------------------------------------------------
  var LANGNAMES = {spa: 'Español', eng: 'English', por: 'Português', fre: 'Français', fra: 'Français', ger: 'Deutsch', deu: 'Deutsch', ita: 'Italiano', dut: 'Nederlands', pol: 'Polski', rus: 'Русский',
    ara: 'العربية', tur: 'Türkçe', rum: 'Română', hun: 'Magyar', cze: 'Čeština', swe: 'Svenska', nor: 'Norsk', dan: 'Dansk', fin: 'Suomi', gre: 'Ελληνικά', heb: 'עברית', jpn: '日本語', kor: '한국어', chi: '中文', zho: '中文',
    es: 'Español', en: 'English', pt: 'Português', fr: 'Français', de: 'Deutsch', it: 'Italiano'};
  function srtToVtt(t) {
    t = t.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    if (/^WEBVTT/.test(t)) return t;
    return 'WEBVTT\n\n' + t.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  }
  function decode(buf) {
    try { return new TextDecoder('utf-8', {fatal: true}).decode(buf); } catch (e) {}
    try { return new TextDecoder('windows-1252').decode(buf); } catch (e2) {}
    var s = '', u = new Uint8Array(buf), i;
    for (i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return s;
  }
  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var hh = Math.floor(sec / 3600), mm = Math.floor(sec / 60) % 60, ss = sec % 60;
    return (hh ? hh + ':' + (mm < 10 ? '0' : '') : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function openPlayer(url, stream, ctx) {
    var box = $('player'), v = h('video'), ov = h('div', 'ov'), ttl = h('div', 'ttl', ctx.title || ''), tim = h('div', 'tim'), trk = h('div', 'trk'), fill = h('i'), stat = h('div', 'stat', T('Cargando…', 'Loading…', 'A carregar…'));
    empty(box);
    trk.appendChild(fill); ov.appendChild(ttl); ov.appendChild(tim); ov.appendChild(trk);
    box.appendChild(v); box.appendChild(ov); box.appendChild(stat);
    box.style.display = 'block';
    var P = {v: v, ctx: ctx, menu: null, hideAt: 0, lastKey: 0, lastSave: 0, watched: 0, tracks: [], subs: null, active: -1, resumed: false, ended: false};
    playing = P;
    v.autoplay = true;
    v.src = url;
    var startMs = ctx.resume || 0;
    function wake() { ov.className = 'ov'; P.hideAt = Date.now() + 4500; }
    P.wake = wake;
    v.addEventListener('loadedmetadata', function () {
      if (!P.resumed && startMs > 10000 && v.duration && startMs < v.duration * 1000 - 30000) v.currentTime = startMs / 1000 - 3;
      P.resumed = true;
      loadSubs();
    });
    v.addEventListener('playing', function () { stat.textContent = ''; });
    v.addEventListener('waiting', function () { stat.textContent = T('Cargando…', 'Buffering…', 'A carregar…'); });
    v.addEventListener('canplay', function () { stat.textContent = ''; });
    v.addEventListener('error', function () {
      var c = v.error ? v.error.code : 0;
      stat.textContent = T('Esta tele no puede reproducir este vídeo (código ' + c + '). Pulsa Atrás y prueba otra fuente.', 'This TV cannot play this video (code ' + c + '). Press Back and try another source.', 'A TV não consegue reproduzir (código ' + c + '). Volte e tente outra fonte.');
      wake();
    });
    v.addEventListener('ended', function () { P.ended = true; closePlayer(true); });
    P.timer = setInterval(function () {
      var d = v.duration || 0, t = v.currentTime || 0;
      tim.textContent = fmt(t) + ' / ' + fmt(d) + (v.paused ? '   ⏸' : '');
      fill.style.width = d ? (100 * t / d) + '%' : '0';
      if (Date.now() > P.hideAt && !v.paused && !P.menu) ov.className = 'ov hide';
      if (!v.paused && t > 0) P.watched += 0.5;
      if (Date.now() - P.lastSave > 60000 && t > 0) saveProgress(P);
    }, 500);
    wake();

    function loadSubs() {
      var meta = ctx.meta || {id: ctx.id, type: ctx.type}, list = addonsFor('subtitles', ctx.type, ctx.videoId), got = 0, all = [];
      P.tracks = all;
      if (!list.length) return;
      var extra = stream && stream.behaviorHints && stream.behaviorHints.filename ? '/filename=' + enc(stream.behaviorHints.filename) : '';
      list.forEach(function (a) {
        getJson(addonBase(a) + '/subtitles/' + enc(ctx.type) + '/' + enc(ctx.videoId) + extra + '.json', function (err, j) {
          got++;
          var ss = (j && j.subtitles) || [], i;
          for (i = 0; i < ss.length; i++) if (ss[i] && ss[i].url) all.push({url: ss[i].url, lang: String(ss[i].lang || '').toLowerCase(), addon: addonName(a)});
          if (got === list.length && playing === P && P.active < 0) autoSub();
        });
      });
      void meta;
    }
    function autoSub() {
      var pref = subPref(), i;
      if (pref === 'off') return;
      var two = {spa: 'es', eng: 'en', por: 'pt', fre: 'fr', ger: 'de', ita: 'it'}[pref];
      for (i = 0; i < P.tracks.length; i++) if (P.tracks[i].lang === pref || P.tracks[i].lang === two || P.tracks[i].lang.indexOf(pref) === 0) { chooseSub(i); return; }
    }
    function chooseSub(i) {
      var old = v.querySelectorAll('track'), k;
      for (k = 0; k < old.length; k++) v.removeChild(old[k]);
      P.active = i;
      if (i < 0) return;
      var t = P.tracks[i], x = new XMLHttpRequest();
      x.open('GET', t.url, true);
      x.responseType = 'arraybuffer';
      x.timeout = 20000;
      x.onload = function () {
        if (x.status < 200 || x.status >= 300 || playing !== P || P.active !== i) return;
        var blob = new Blob([srtToVtt(decode(x.response))], {type: 'text/vtt'}), tr = document.createElement('track');
        tr.kind = 'subtitles'; tr.label = LANGNAMES[t.lang] || t.lang; tr.srclang = t.lang.slice(0, 2); tr.src = URL.createObjectURL(blob); tr['default'] = true;
        v.appendChild(tr);
        setTimeout(function () { if (v.textTracks && v.textTracks.length) v.textTracks[v.textTracks.length - 1].mode = 'showing'; }, 100);
      };
      x.onerror = x.ontimeout = function () { toast(T('No se pudo cargar el subtítulo', 'Could not load the subtitle', 'Legenda indisponível')); };
      x.send();
    }
    P.chooseSub = chooseSub;
    P.openMenu = function () {
      var m = h('div', 'menu'), items = [{label: T('Sin subtítulos', 'Subtitles off', 'Sem legendas'), i: -1}], k;
      for (k = 0; k < P.tracks.length; k++) items.push({label: (LANGNAMES[P.tracks[k].lang] || P.tracks[k].lang || '?') + ' · ' + P.tracks[k].addon + ' ' + (k + 1), i: k});
      m.appendChild(h('h3', '', T('Subtítulos', 'Subtitles', 'Legendas')));
      var sel = 0;
      items.forEach(function (it, n) { if (it.i === P.active) sel = n; });
      P.menu = {el: m, items: items, sel: sel};
      function paint() {
        var rows = m.querySelectorAll('.mi'), n;
        for (n = 0; n < rows.length; n++) rows[n].className = 'mi' + (n === P.menu.sel ? ' on' : '') + (items[n].i === P.active ? ' cur' : '');
        var onEl = rows[P.menu.sel];
        if (onEl) m.scrollTop = Math.max(0, onEl.offsetTop - 200);
      }
      items.forEach(function (it) { m.appendChild(h('div', 'mi', it.label)); });
      box.appendChild(m);
      P.menu.paint = paint;
      paint();
      if (!P.tracks.length) toast(T('Ningún addon ofrece subtítulos para este título', 'No addon offers subtitles for this title', 'Sem legendas'), 3000);
      wake();
    };
    P.closeMenu = function () { if (P.menu) { box.removeChild(P.menu.el); P.menu = null; } };
  }

  function saveProgress(P) {
    var v = P.v, ctx = P.ctx, meta = ctx.meta;
    P.lastSave = Date.now();
    if (!S.authKey || !meta || !v.duration || !isFinite(v.duration)) return;
    var l = libItem(meta), s = l.state || (l.state = {}), ms = Math.round(v.currentTime * 1000), dur = Math.round(v.duration * 1000);
    var delta = Math.round(P.watched * 1000);
    P.watched = 0;
    s.timeOffset = ms; s.duration = dur; s.video_id = ctx.videoId; s.lastWatched = nowIso();
    s.timeWatched = num(s.timeWatched) + delta; s.overallTimeWatched = num(s.overallTimeWatched) + delta;
    if (P.ended) { s.timeOffset = 0; s.flaggedWatched = num(s.flaggedWatched) + 1; s.timesWatched = num(s.timesWatched) + 1; }
    l.name = meta.name || l.name; l.poster = meta.poster || l.poster; l.background = meta.background || l.background; l.logo = meta.logo || l.logo;
    libPut(l);
  }
  function closePlayer(ended) {
    var P = playing;
    if (!P) return;
    playing = null;
    clearInterval(P.timer);
    try { saveProgress(P); } catch (e) {}
    try { P.v.pause(); P.v.removeAttribute('src'); P.v.load(); } catch (e2) {}
    $('player').style.display = 'none';
    empty($('player'));
    if (ended) {
      // the next episode, when there is one
      var meta = P.ctx.meta, eps = meta && meta.type === 'series' ? episodes(meta) : [], i;
      for (i = 0; i < eps.length - 1; i++) if (eps[i].id === P.ctx.videoId) {
        var nx = eps[i + 1];
        go('streams', {type: P.ctx.type, id: P.ctx.id, videoId: nx.id, title: meta.name + ' · ' + epLabel(nx), meta: meta, resume: 0}, true);
        return;
      }
      back();
    }
  }
  function playerKey(e) {
    var P = playing, v = P.v, k = e.keyCode, now = Date.now();
    P.wake();
    if (P.menu) {
      if (k === 38 && P.menu.sel > 0) P.menu.sel--;
      else if (k === 40 && P.menu.sel < P.menu.items.length - 1) P.menu.sel++;
      else if (k === 13) { P.chooseSub(P.menu.items[P.menu.sel].i); P.closeMenu(); return; }
      else if (k === 10009 || k === 27 || k === 8 || k === 37 || k === 39) { P.closeMenu(); return; }
      P.menu.paint();
      return;
    }
    if (k === 13 || k === 10252 || k === 415 || k === 19 || k === 179) { if (v.paused || k === 415) v.play(); else v.pause(); }
    else if (k === 37 || k === 412) { v.currentTime = Math.max(0, v.currentTime - (now - P.lastKey < 400 ? 30 : 10)); }
    else if (k === 39 || k === 417) { v.currentTime = Math.min((v.duration || 1e9) - 1, v.currentTime + (now - P.lastKey < 400 ? 30 : 10)); }
    else if (k === 38) P.openMenu();
    else if (k === 10009 || k === 27 || k === 8 || k === 413) closePlayer(false);
    P.lastKey = now;
  }

  // ---- keys ---------------------------------------------------------------------------------------------------------
  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (playing) { playerKey(e); e.preventDefault(); return; }
    if (k === 37) move('left');
    else if (k === 39) move('right');
    else if (k === 38) move('up');
    else if (k === 40) move('down');
    else if (k === 13) { if (cur && cur.act) cur.act(); }
    else if (k === 10009 || k === 27 || k === 8) back();
    else return;
    e.preventDefault();
  });
  (function registerKeys() {
    try {
      if (window.tizen && tizen.tvinputdevice) ['MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'MediaRewind', 'MediaFastForward'].forEach(function (n) {
        try { tizen.tvinputdevice.registerKey(n); } catch (e) {}
      });
    } catch (e2) {}
  })();
  window.addEventListener('beforeunload', function () { if (playing) closePlayer(false); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && playing) { try { playing.v.pause(); } catch (e) {} } });

  // ---- start --------------------------------------------------------------------------------------------------------
  function signedIn(authKey) {
    S.authKey = authKey;
    store.set('authKey', authKey);
    store.set('guest', null);
    api('getUser', {authKey: authKey}, function (err, u) {
      if (u) { S.user = {email: u.email || '', fullname: u.fullname || ''}; store.set('user', JSON.stringify(S.user)); }
      start();
    });
  }
  function opening() {
    // stremio/index.html#open=movie/tt0111161 (FreeTV opens a title from its home)
    var m = /open=([a-z]+)\/([^&\/]+)/.exec(window.location.hash || '');
    return m ? {type: m[1], id: decodeURIComponent(m[2])} : null;
  }
  function start() {
    stack = []; here = null;
    if (!S.authKey && !store.get('guest')) { loadAddons(function () { go('login', {}); }); return; }
    loadAddons(function () {
      loadLibrary(function () {
        var o = opening();
        go('home', {}, true);
        if (o) go('detail', {type: o.type, id: o.id, item: {id: o.id, type: o.type}});
      });
    });
  }
  window.StremioClaude = {S: S, go: go, back: back, catalogs: catalogs, srtToVtt: srtToVtt, catExtra: catExtra, hasRes: hasRes, episodes: episodes};
  start();
})();
