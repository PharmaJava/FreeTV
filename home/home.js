/*
 * The home screen for web-app TVs (LG webOS, Samsung Tizen), with the Android app's design and behavior (HomeView):
 *  - top: the "For You" title and the tabs (Explore, Movies, Shows); icon-only glass buttons at the right (Live TV,
 *    HDMI Inputs, Settings) and the crypto quotes at the end of the tab row;
 *  - three picks for this hour in the selected tab; the background is the first one's photo, blurred and almost white;
 *  - the glass shelf with the apps; ↓ opens the drawer (inputs, shortcuts, weather, prices); ↑ or Back closes it;
 *  - a night look from sunset to sunrise; a screensaver after a few idle minutes.
 * The remote's arrows, OK and Back move the focus; a pointer (LG's Magic Remote) focuses what it points at.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, parent, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function sym(name, parent, size) {
    var s = el('span', 'sym', parent);
    s.style.webkitMaskImage = 'url(symbols/' + name + '.png)';
    s.style.maskImage = 'url(symbols/' + name + '.png)';
    if (size) { s.style.width = size + 'px'; s.style.height = size + 'px'; }
    return s;
  }

  function coin(i, parent) {
    var c = window.COINS && window.COINS[i];
    if (!c) return;
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    for (var k = 0; k < c.length; k++) {
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', c[k]);
      p.setAttribute('fill-rule', 'evenodd');
      svg.appendChild(p);
    }
    parent.appendChild(svg);
  }

  function hasClass(e, c) { return (' ' + e.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  function setClass(e, c, on) {
    if (!e) return;
    if (on && !hasClass(e, c)) e.className = (e.className + ' ' + c).replace(/^\s+/, '');
    else if (!on && hasClass(e, c)) e.className = (' ' + e.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }

  var stage = $('stage'), body = document.body;
  setClass(body, 'tv-' + TV.name, true);   // 'tv-webos', 'tv-tizen' or 'tv-browser', for the few differences

  /** The 1920 × 1080 stage fills the window (on the TV it already is 1920 × 1080). */
  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.webkitTransform = stage.style.transform = s === 1 ? '' : 'scale(' + s + ')';
  }

  // MARK: - Apps on the shelf

  /** Shelf apps in this order when installed, like the Android app: key, LG app id, name on the TV, brand gradient. */
  var SHELF = [
    ['netflix', /^netflix$/, /netflix/i, ['#0A0A0A', '#000000']],
    ['youtube', /youtube/, /^youtube$/i, ['#1C1C1E', '#09090A']],
    ['prime', /^amazon$/, /prime video|amazon/i, ['#2AA8FF', '#0A68D4']],
    ['disney', /disney/, /disney/i, ['#173584', '#08143F']],
    ['max', /hbo|wbd/, /^(hbo )?max$|hbo max/i, ['#5C30E8', '#221684']],
    ['live', /^com\.webos\.app\.livetv$/, /tv em direto|live tv|tv en directo/i, ['#2A8CFF', '#0A3FA8']],
    ['hulu', /^hulu/, /hulu/i, ['#1CE783', '#0B8F4E']],
    ['paramount', /paramount|cbs/, /paramount/i, ['#0064FF', '#002A86']],
    ['peacock', /peacock/, /peacock/i, ['#1C1C1E', '#000000']],
    ['nfl', /nfl/, /^nfl/i, ['#013369', '#00163D']],
    ['globoplay', /globoplay/, /globoplay/i, ['#FF8A1F', '#FF2D5A']],
    ['spotify', /spotify/, /spotify/i, ['#1DB954', '#0F7A36']]
  ];
  var MAX_SHELF = 12;

  function shelfKey(app) {
    for (var i = 0; i < SHELF.length; i++) if (SHELF[i][1].test(app.id) || SHELF[i][2].test(app.title)) return SHELF[i];
    return null;
  }

  function darken(hex, f) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#161618';
    var n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgb(' + Math.round(r * f) + ',' + Math.round(g * f) + ',' + Math.round(b * f) + ')';
  }

  /** A name that fits the tile on one line (the font shrinks for long names). */
  function wordFit(title, width, max) {
    return Math.max(18, Math.min(max, Math.floor(width * 0.8 / (Math.max(4, title.length) * 0.56))));
  }

  /** An app's face: its own icon on its brand color (or its name, when the icon can't be read). */
  function face(app, box, wordSize) {
    var k = shelfKey(app);
    var top = k ? k[3][0] : app.color ? darken(app.color, 0.92) : '#2A2A2E';
    var bottom = k ? k[3][1] : app.color ? darken(app.color, 0.62) : '#161618';
    box.style.background = '-webkit-linear-gradient(top, ' + top + ', ' + bottom + ')';
    box.style.background = 'linear-gradient(' + top + ', ' + bottom + ')';
    if (app.symbol) { el('span', 'sym bigsym', box).style.webkitMaskImage = 'url(symbols/' + app.symbol + '.png)'; box.lastChild.style.maskImage = 'url(symbols/' + app.symbol + '.png)'; return; }
    var word = el('div', 'word', box, app.title);
    if (wordSize) word.style.fontSize = wordSize + 'px';
    if (app.icon) {
      // LG's icons are squares with their own background: they fill the whole tile, as on the TV's own home.
      var img = el('img', 'ico', box);
      word.style.visibility = 'hidden';
      img.onerror = function () { img.parentNode.removeChild(img); word.style.visibility = ''; };
      img.src = app.icon;
    }
  }

  var apps = [], shelf = [], others = [], inputs = [];

  function pickShelf() {
    var chosen = Prefs.shelf(), out = [];
    if (chosen) {
      for (var i = 0; i < chosen.length && out.length < MAX_SHELF; i++) {
        for (var j = 0; j < apps.length; j++) if (apps[j].id === chosen[i]) out.push(apps[j]);
      }
    } else {
      for (var s = 0; s < SHELF.length && out.length < MAX_SHELF; s++) {
        for (var a = 0; a < apps.length; a++) {
          if ((SHELF[s][1].test(apps[a].id) || SHELF[s][2].test(apps[a].title)) && out.indexOf(apps[a]) < 0) { out.push(apps[a]); break; }
        }
      }
      if (!out.length) out = apps.slice(0, MAX_SHELF);
    }
    shelf = out;
    others = apps.filter(function (x) { return shelf.indexOf(x) < 0; });
  }

  // MARK: - Focus

  var Z = {TOP: 'top', CARDS: 'cards', SHELF: 'shelf', DRAWER: 'drawer', APPS: 'apps', SETTINGS: 'settings', EDIT: 'edit', SUGG: 'suggest', COMM: 'community'};
  var st = {zone: Z.SHELF, top: 0, tab: 0, card: 0, shelf: 0, drawer: 0, grid: 0, row: 0, edit: 0, sug: 0, comm: 0};
  var cards = [];

  function sheetOpen() { return st.zone === Z.APPS || st.zone === Z.SETTINGS || st.zone === Z.EDIT || st.zone === Z.SUGG || st.zone === Z.COMM; }

  function updateFocus() {
    var i, list;
    list = $('tabs').children;
    for (i = 0; i < list.length; i++) {
      setClass(list[i], 'on', i === st.tab);
      setClass(list[i], 'focus', st.zone === Z.TOP && st.top === i);
    }
    list = $('buttons').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.TOP && st.top === 3 + i);
    setClass($('quotes'), 'hide', st.zone === Z.TOP && st.top >= 3);
    list = $('cards').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.CARDS && st.card === i);
    if (st.zone === Z.CARDS) {
      // keep the focused card inside the screen, and let the blurred background follow it
      cardShift = st.card > 0 ? Math.max(0, cardLeft(st.card) + SMALL_W - 1840) : 0;
      $('cards').style.webkitTransform = $('cards').style.transform = cardShift ? 'translateX(' + (-cardShift) + 'px)' : '';
      if (cards[st.card] && cards[st.card] !== bgShown) { bgShown = cards[st.card]; backdrop(Data.image(bgShown.backdrop, 'w300')); }
    }
    list = $('tiles').children;
    for (i = 0; i < list.length; i++) {
      setClass(list[i], 'focus', st.zone === Z.SHELF && st.shelf === i);
      setClass(list[i], 'grab', grabbed === i);
    }
    list = document.querySelectorAll('#drawer .key');
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.DRAWER && st.drawer === i);
    list = document.querySelectorAll('#apps .cell');
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.APPS && st.grid === i);
    var rows = Math.max(1, Math.ceil(others.length / APP_COLS)), r = Math.floor(st.grid / APP_COLS), first = Math.max(0, Math.min(rows - 3, r - 1));
    $('apps').lastChild.style.webkitTransform = $('apps').lastChild.style.transform = 'translateY(' + (-first * APP_DY) + 'px)';
    focusRows($('settings'), st.row, st.zone === Z.SETTINGS);
    focusRows($('shelfedit'), st.edit, st.zone === Z.EDIT);
    focusRows($('suggest'), st.sug, st.zone === Z.SUGG);
    focusRows($('community'), commOpen < 0 ? st.comm : commAct, st.zone === Z.COMM);
    setClass(body, 'drawer-open', st.zone === Z.DRAWER);
  }

  function focusRows(sheet, index, on) {
    var rows = sheet.querySelectorAll('.row');
    for (var i = 0; i < rows.length; i++) setClass(rows[i], 'focus', on && i === index);
    var holder = sheet.querySelector('.rows');
    if (!holder) return;
    var visible = 7, first = Math.max(0, Math.min(rows.length - visible, index - 3));
    holder.style.webkitTransform = holder.style.transform = 'translateY(' + (-first * 78) + 'px)';
  }

  function nearest(nodes, x) {
    var best = 0, bestD = 1e9;
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect(), d = Math.abs((r.left + r.right) / 2 - x);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function centerX(node) {
    if (!node) return 960;
    var r = node.getBoundingClientRect();
    return (r.left + r.right) / 2;
  }

  // MARK: - Top: title, tabs, buttons, quotes

  var TAB_KIND = [null, 'movie', 'tv'];

  function renderTop() {
    $('title').textContent = tr('Para você', 'For You', 'Para ti');
    var tabs = $('tabs');
    tabs.innerHTML = '';
    var names = [tr('Explorar', 'Explore', 'Explorar'), tr('Filmes', 'Movies', 'Películas'), tr('Séries', 'Shows', 'Series')];
    for (var i = 0; i < 3; i++) {
      var t = el('button', 'tab', tabs, names[i]);
      hover(t, Z.TOP, i);
    }
    var buttons = $('buttons');
    buttons.innerHTML = '';
    var defs = [['live_tv', tr('TV aberta', 'Live TV', 'TV en vivo')], ['hdmi', tr('Entradas HDMI', 'HDMI Inputs', 'Entradas HDMI')],
      ['settings', tr('Ajustes', 'Settings', 'Ajustes')]];
    for (var b = 0; b < 3; b++) {
      var r = el('button', 'round' + (b === 2 ? ' last' : ''), buttons);
      r.style.left = (1596 + 88 * b) + 'px';
      sym(defs[b][0], r);
      el('div', 'tip', r, defs[b][1]);
      hover(r, Z.TOP, 3 + b);
    }
  }

  var QUOTE_TAGS = {4: 'XRP', 5: 'S&P', 6: 'NDX'};

  function renderQuotes() {
    var q = $('quotes'), coins = Data.activeCoins();
    q.innerHTML = '';
    for (var i = 0; i < coins.length; i++) {
      var item = el('span', 'q', q);
      var tag = QUOTE_TAGS[coins[i]];
      if (tag) el('b', '', item, tag);   // XRP and the funds have no logo
      else coin(coins[i], item);
      el('span', '', item, Data.compact(Data.prices[coins[i]]));
    }
  }

  // MARK: - Picks and background

  // One wide card, then as many tall ones as there are picks; the row slides sideways to keep the focused one in view.
  var HERO_W = 1040, SMALL_W = 320, CARD_GAP = 40, cardShift = 0, bgShown = null;
  function cardLeft(c) { return c === 0 ? 80 : 80 + HERO_W + CARD_GAP + (c - 1) * (SMALL_W + CARD_GAP); }

  function renderCards() {
    var list = Data.picks(TAB_KIND[st.tab]);
    var holder = $('cards');
    setClass(body, 'no-picks', !list.length);
    var same = list.length === cards.length;
    for (var i = 0; same && i < list.length; i++) same = list[i].id === cards[i].id && list[i].backdrop === cards[i].backdrop && list[i].meta === cards[i].meta && list[i].service === cards[i].service;
    if (same && holder.children.length === list.length) return;
    cards = list;
    holder.innerHTML = '';
    cardShift = 0;
    holder.style.webkitTransform = holder.style.transform = '';
    for (var c = 0; c < list.length; c++) {
      var p = list[c], card = el('div', 'card', holder);
      card.style.left = cardLeft(c) + 'px';
      card.style.width = (c === 0 ? HERO_W : SMALL_W) + 'px';
      var img = el('div', 'img', card);
      img.style.backgroundImage = 'url(' + Data.image(p.backdrop, c === 0 ? 'w1280' : 'w780') + ')';
      el('div', 'name', card, p.title);
      // The wide card says everything; the others say what it is and where to watch it.
      var meta = c === 0 ? p.meta : (p.kind === 'tv' ? tr('Série', 'Series', 'Serie') : tr('Filme', 'Movie', 'Película')) + (p.service ? ' · ' + p.service : '');
      if (meta) el('div', 'meta', card, meta);
      hover(card, Z.CARDS, c);
    }
    st.card = Math.min(st.card, Math.max(0, list.length - 1));
    if (!list.length && st.zone === Z.CARDS) st.zone = Z.SHELF;
    bgShown = list.length ? list[0] : null;
    backdrop(list.length ? Data.image(list[0].backdrop, 'w300') : '');
    updateFocus();
  }

  var bgUrl = null, bgFront = 'bgA';

  /** The first pick's photo as the background: drawn tiny and stretched, it's already as soft as a heavy blur. */
  function backdrop(url) {
    if (url === bgUrl) return;
    bgUrl = url;
    var next = bgFront === 'bgA' ? 'bgB' : 'bgA';
    if (!url) {
      setClass($('bgA'), 'on', false);
      setClass($('bgB'), 'on', false);
      return;
    }
    var img = new Image();
    img.onload = function () {
      if (bgUrl !== url) return;
      var canvas = $(next), ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setClass(canvas, 'on', true);
      setClass($(bgFront), 'on', false);
      bgFront = next;
    };
    img.src = url;
  }

  function renderClock() {
    var d = new Date(), c = $('clock');
    c.firstChild.textContent = Data.time(d.getTime());
    try {
      c.lastChild.textContent = d.toLocaleDateString(I18N.locale(), {weekday: 'long', day: 'numeric', month: 'long'});
    } catch (e) {
      c.lastChild.textContent = d.toDateString();
    }
  }

  // MARK: - Shelf

  // The shelf sits a little lower than on Android, so it never touches the captions of the picks above it.
  var SHELF_DROP = 26;

  function renderShelf() {
    var n = shelf.length, gap = n > 9 ? 30 : 44, pad = 40;
    // Square app icons, as on the TV's own home: never bigger than 140, and the glass keeps its bottom edge.
    var tw = Math.min(140, (1760 - Math.max(0, n - 1) * gap) / Math.max(1, n)), th = tw;
    var width = n * tw + Math.max(0, n - 1) * gap, left = (1920 - width) / 2;
    var platter = $('platter');
    platter.style.display = n ? '' : 'none';
    platter.style.left = (left - pad) + 'px';
    platter.style.width = (width + 2 * pad) + 'px';
    platter.style.top = (814 + SHELF_DROP + 126 - th) + 'px';
    platter.style.height = (th + 2 * pad) + 'px';
    $('quotes').style.right = (1920 - left - width) + 'px';
    var tiles = $('tiles');
    tiles.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var t = el('div', 'tile', tiles);
      t.style.left = (left + i * (tw + gap)) + 'px';
      t.style.top = (854 + SHELF_DROP + 126 - th) + 'px';
      t.style.width = tw + 'px';
      t.style.height = th + 'px';
      face(shelf[i], t, wordFit(shelf[i].title, tw, 30));
      hover(t, Z.SHELF, i);
    }
    st.shelf = Math.min(st.shelf, Math.max(0, n - 1));
  }

  // MARK: - Drawer

  var drawerItems = [], drawerInputs = 0;

  function renderDrawer() {
    var d = $('drawer');
    d.innerHTML = '';
    drawerItems = [];
    for (var i = 0; i < inputs.length; i++) {
      var x = inputs[i];
      drawerItems.push({label: x.label || tr('TV aberta', 'Live TV', 'TV en vivo'), symbol: x.symbol, off: !x.connected, run: launcher(x.id, x.label)});
    }
    drawerInputs = drawerItems.length;
    drawerItems.push({label: tr('Todos os Apps', 'All Apps', 'Todas las apps'), symbol: 'apps', run: openApps});
    drawerItems.push({label: tr('Ajustes do Início', 'Home Settings', 'Ajustes de inicio'), symbol: 'settings', run: openSettings});
    drawerItems.push({label: tr('Ajustes da TV', 'TV Settings', 'Ajustes del TV'), symbol: 'tv_settings', run: tvSettings});
    var n = drawerItems.length, gap = 18, groupGap = 56, groups = drawerInputs > 0 && drawerInputs < n ? 2 : 1;
    var tw = Math.min(230, (1760 - Math.max(0, n - groups) * gap - (groups - 1) * groupGap) / Math.max(1, n));
    var xPos = 80;
    for (var k = 0; k < n; k++) {
      if (k === drawerInputs && k > 0) {
        xPos += groupGap - gap;
        el('div', 'row-title', d, tr('Atalhos', 'Shortcuts', 'Accesos directos')).style.left = (xPos + 4) + 'px';
      }
      if (k === 0 && drawerInputs) el('div', 'row-title', d, tr('Entradas', 'Inputs', 'Entradas')).style.left = '84px';
      var item = drawerItems[k], key = el('div', 'key glass' + (item.off ? ' off' : ''), d);
      key.style.left = xPos + 'px';
      key.style.width = tw + 'px';
      sym(item.symbol, key);
      el('div', 'label', key, item.label);
      hover(key, Z.DRAWER, k);
      xPos += tw + gap;
    }
    renderPanels();
    updateFocus();
  }

  function renderPanels() {
    var d = $('drawer');
    var old = d.querySelectorAll('.panel');
    for (var o = 0; o < old.length; o++) d.removeChild(old[o]);
    var wx = Prefs.weather(), coins = Data.activeCoins(), qt = coins.length > 0;
    var split = 80 + 1760 * 0.585;
    if (wx) {
      var w = el('div', 'panel glass', d);
      w.id = 'weather';
      w.style.left = '80px';
      w.style.width = ((qt ? split - 16 : 1840) - 80) + 'px';
      renderWeather(w);
    }
    if (qt) {
      var q = el('div', 'panel glass', d);
      q.id = 'prices';
      var left = wx ? split + 16 : 80;
      q.style.left = left + 'px';
      q.style.width = (1840 - left) + 'px';
      renderPrices(q, coins);
    }
  }

  function renderWeather(card) {
    el('div', 'head', card, Data.city || tr('Clima', 'Weather', 'Clima'));
    var w = Data.weather;
    if (!w) {
      el('div', 'cond', card, tr('Sem dados do clima agora.', 'No weather data right now.', 'No hay datos del clima ahora.')).style.top = '96px';
      return;
    }
    var now = el('div', 'now', card);
    sym(Data.symbol(w.code, w.isDay), now);
    el('span', 'temp', now, Data.degrees(w.temp));
    el('div', 'cond', card, Data.condition(w.code, w.isDay));
    el('div', 'range', card, I18N.lang === 'ru' ? 'Макс. ' + Data.degrees(w.max) + '   Мин. ' + Data.degrees(w.min) : tr('Máx. ' + Data.degrees(w.max) + '   Mín. ' + Data.degrees(w.min), 'H:' + Data.degrees(w.max) + '   L:' + Data.degrees(w.min),
        'Máx. ' + Data.degrees(w.max) + '   Mín. ' + Data.degrees(w.min)));
    el('div', 'split', card);
    var hours = el('div', 'hours', card), width = parseFloat(card.style.width) - 30 - 422, hw = width / 6;
    for (var i = 0; i < w.hours.length && i < 6; i++) {
      var h = el('div', 'hour', hours), x = w.hours[i];
      h.style.left = (hw * i) + 'px';
      h.style.width = hw + 'px';
      el('div', 't', h, Data.hour(x.at));
      sym(Data.symbol(x.code, x.day), h);
      el('div', 'd', h, Data.degrees(x.temp));
    }
    var sun = el('div', 'sun', card);
    if (w.sunrise) { var a = el('span', '', sun); sym('sunrise', a); a.appendChild(document.createTextNode(tr('Nascer ', 'Sunrise ', 'Amanecer ') + Data.time(w.sunrise))); }
    if (w.sunset) { var b = el('span', '', sun); sym('sunset', b); b.appendChild(document.createTextNode(tr('Pôr do sol ', 'Sunset ', 'Atardecer ') + Data.time(w.sunset))); }
  }

  function renderPrices(card, coins) {
    el('div', 'head', card, tr('Mercados', 'Markets', 'Mercados'));
    var stale = Data.staleness(Data.pricesAt, 5 * 60000);
    el('div', 'side', card, stale || tr('variação em 24 h', '24h change', 'variación en 24 h'));
    var pitch = coins.length > 4 ? 44 : 52, first = coins.length > 4 ? 78 : 86;   // up to six rows fit the panel
    for (var j = 0; j < coins.length; j++) {
      var i = coins[j], row = el('div', 'coin', card);
      row.style.top = (first + pitch * j) + 'px';
      coin(i, row);
      el('span', 'n', row, Data.coinName(i));
      el('span', 'p', row, Data.money(Data.prices[i], i));
      var ch = Data.changes[i];
      if (!isNaN(ch)) el('span', 'c ' + (ch >= 0 ? 'up' : 'down'), row, Data.change(ch));
    }
  }

  function openDrawer() {
    if (!drawerItems.length) return;
    var tiles = $('tiles').children;
    st.zone = Z.DRAWER;
    st.drawer = Math.min(drawerItems.length - 1, nearest(document.querySelectorAll('#drawer .key'), centerX(tiles[st.shelf])));
    updateFocus();
  }

  function closeDrawer() {
    var keys = document.querySelectorAll('#drawer .key');
    st.zone = Z.SHELF;
    if (shelf.length) st.shelf = nearest($('tiles').children, centerX(keys[st.drawer]));
    updateFocus();
  }

  // MARK: - All Apps

  // Square icons, eight to a row.
  var APP_COLS = 8, APP_LEFT = 160, APP_DX = 215, APP_DY = 250;

  function renderApps() {
    var sheet = $('apps');
    sheet.firstChild.textContent = tr('Todos os Apps', 'All Apps', 'Todas las apps');
    var grid = sheet.lastChild;
    grid.innerHTML = '';
    for (var i = 0; i < others.length; i++) {
      var r = Math.floor(i / APP_COLS), c = i % APP_COLS, cell = el('div', 'cell', grid);
      cell.style.left = (APP_LEFT + c * APP_DX) + 'px';
      cell.style.top = (196 + r * APP_DY) + 'px';
      face(others[i], el('div', 'face', cell), wordFit(others[i].title, 150, 28));
      el('div', 'label', cell, others[i].title);
      hover(cell, Z.APPS, i);
    }
  }

  function openApps() {
    renderApps();
    st.zone = Z.APPS;
    st.grid = 0;
    setClass($('apps'), 'open', true);
    updateFocus();
  }

  function closeSheets() {
    setClass($('apps'), 'open', false);
    setClass($('settings'), 'open', false);
    setClass($('shelfedit'), 'open', false);
    setClass($('suggest'), 'open', false);
    setClass($('community'), 'open', false);
    st.zone = Z.SHELF;
    updateFocus();
  }

  // MARK: - Home Settings

  function settingRows() {
    var lang = Prefs.language(), unit = Prefs.temperature(), theme = Prefs.theme();
    var auto = tr('Automático', 'Automatic', 'Automático'), on = tr('Ligado', 'On', 'Activado'), off = tr('Desligado', 'Off', 'Desactivado');
    var rows = [
      {label: tr('Idioma', 'Language', 'Idioma'), value: lang === 'ru' ? 'Русский' : lang === 'de' ? 'Deutsch' : lang === 'pt' ? 'Português' : lang === 'en' ? 'English' : lang === 'es' ? 'Español' : auto,
        step: function (d) { cycle('language', ['auto', 'de', 'en', 'es', 'pt', 'ru'], lang, d); I18N.set(Prefs.language()); renderAll(); }},
      {label: tr('Temperatura', 'Temperature', 'Temperatura'), value: unit === 'C' ? '°C' : unit === 'F' ? '°F' : auto,
        step: function (d) { cycle('temperature', ['auto', 'C', 'F'], unit, d); renderPanels(); }},
      {label: tr('Tema', 'Theme', 'Tema'), value: theme === 'light' ? tr('Claro', 'Light', 'Claro') : theme === 'dark' ? tr('Escuro', 'Dark', 'Oscuro') : auto,
        step: function (d) { cycle('theme', ['auto', 'light', 'dark'], theme, d); checkNight(); }},
      {label: tr('Widget do clima', 'Weather widget', 'Widget del clima'), toggle: Prefs.weather(),
        step: function () { Prefs.set('weather', !Prefs.weather()); renderPanels(); }},
      {label: tr('Widget de cotações', 'Quotes widget', 'Widget de cotizaciones'), toggle: Prefs.quotes(),
        step: function () { Prefs.set('quotes', !Prefs.quotes()); Data.settingsChanged(); }}
    ];
    var names = ['Bitcoin', 'Ethereum', 'Solana', tr('Dólar', 'Dollar', 'Dólar')];
    var count = Data.currency === 'BRL' ? 4 : 3;
    var shown = [];
    for (var c = 0; c < count; c++) shown.push(c);
    shown.push(4, 5, 6);   // XRP, then the iShares S&P 500 and NASDAQ 100 (dollars)
    for (var s = 0; s < shown.length; s++) {
      (function (i) {
        rows.push({label: i < 4 ? names[i] : Data.coinName(i), toggle: Prefs.quotes() && Prefs.coin(i), dim: !Prefs.quotes(),
          step: function () { if (Prefs.quotes()) { Prefs.setCoin(i, !Prefs.coin(i)); Data.settingsChanged(); } }});
      })(shown[s]);
    }
    rows.push({label: tr('Prateleira', 'Shelf', 'Estante'), value: '›', step: function (d) { if (d >= 0) openShelfEdit(); }});
    rows.push({label: tr('Sugestões', 'Suggestions', 'Sugerencias'), value: '›', step: function (d) { if (d >= 0) openSuggest(); }});
    if (TV.name !== 'tizen') rows.push({label: commTitle(), value: '›', step: function (d) { if (d >= 0) openCommunity(); }});
    if (window.HomeExtras) rows = rows.concat(window.HomeExtras.rows());   // Developer Mode renewal, Home button
    rows.push({label: tr('Ajustes da TV', 'TV Settings', 'Ajustes del TV'), value: '›', step: function (d) { if (d >= 0) tvSettings(); }});
    return rows;
  }

  function cycle(name, values, current, d) {
    var i = values.indexOf(current);
    Prefs.set(name, values[(i + (d || 1) + values.length) % values.length]);
  }

  var rowsNow = [];

  function renderSettings() {
    var box = $('settings').firstChild;
    box.innerHTML = '';
    var title = el('div', 'title', box);
    sym('settings', title);
    title.appendChild(document.createTextNode(tr('Ajustes do Início', 'Home Settings', 'Ajustes de inicio')));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    rowsNow = settingRows();
    list.style.height = Math.min(rowsNow.length, 7) * 78 + 'px';
    for (var i = 0; i < rowsNow.length; i++) {
      var r = rowsNow[i], row = el('div', 'row' + (r.dim ? ' dim' : ''), holder, r.label);
      if (r.toggle !== undefined) setClass(el('div', 'toggle', row), 'on', r.toggle);
      else {
        var v = el('span', 'value', row);
        if (r.value === '›') v.textContent = '›';
        else { el('span', 'chev', v, '‹'); v.appendChild(document.createTextNode(r.value)); el('span', 'chev', v, '›'); }
      }
      hover(row, Z.SETTINGS, i);
    }
    el('div', 'hint', box, tr('OK ou as setas mudam o valor.', 'OK or the arrows change the value.', 'OK o las flechas cambian el valor.'));
    updateFocus();
  }

  function openSettings() {
    st.zone = Z.SETTINGS;
    st.row = 0;
    renderSettings();
    setClass($('settings'), 'open', true);
    updateFocus();
  }

  // MARK: - Community apps: the webOS Homebrew catalogue. A TV app cannot install packages without root, so the install is done
  // by the person's computer (tools/community.py serve): the TV asks, the computer downloads, checks the hash and installs.

  var CATALOGUE = 'https://repo.webosbrew.org/api/apps.json';
  var commList = [], commOpen = -1, commState = 'idle', commAct = 0, commActs = [];
  // conn: the computer ('none' = unknown address, 'checking', 'ok', 'off'); flow: this install ('idle', 'asking', 'working', 'done', 'failed')
  var store = {conn: 'none', flow: 'idle', id: '', phase: '', message: '', note: '', misses: 0}, storeTimer = 0;

  function commTitle() { return tr('Apps da comunidade', 'Community apps', 'Apps de la comunidad'); }

  /** Apps that need a word of warning before installing (kept in step with tools/community.py). */
  var COMM_CAUTION = {
    'youtube.leanback.v4': ['Substitui o YouTube oficial: apague-o você na TV antes (o computador não consegue).', 'Replaces the official YouTube: delete it yourself on the TV first (the computer cannot).', 'Reemplaza el YouTube oficial: bórralo tú en la tele antes (desde el ordenador no se puede).'],
    'com.open.hidden.menu': ['Abre o menu de serviço da LG: pode danificar a TV.', "Opens LG's service menu: it can break the TV.", 'Abre el menú de servicio de LG: puede estropear la tele.'],
    'com.pirate.refresh': ['Renova o Modo Desenvolvedor por conta própria: o FreeTV já tem o seu painel.', 'Renews Developer Mode on its own: FreeTV already has its panel.', 'Renueva el Modo Desarrollador por su cuenta: FreeTV ya trae su panel.'],
    'org.webosbrew.hbchannel': ['Só serve por inteiro numa TV com root.', 'Only fully useful on a rooted TV.', 'Solo sirve entera en una tele con root.']
  };
  /** The flag tools/community.py wants for them (CAUTION there): the person gives it by confirming on this screen. */
  var COMM_FLAG = {'youtube.leanback.v4': 'official-removed', 'com.open.hidden.menu': 'sensitive', 'com.pirate.refresh': 'sensitive', 'org.webosbrew.hbchannel': 'sensitive'};

  function privateIp(ip) {
    var p = ip.split('.'), i;
    for (i = 0; i < 4; i++) if (+p[i] > 255) return false;
    return +p[0] === 10 || (+p[0] === 172 && +p[1] >= 16 && +p[1] <= 31) || (+p[0] === 192 && +p[1] === 168);
  }

  /** `community.py serve` opens this app with {storeHost, storePort, n}: keep where the computer is (a new n each time, so an old
      launch's parameters do not reopen the store). Only addresses on a home network. */
  function takeStoreHost(raw) {
    var o = raw;
    if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { return false; } }
    if (!o || typeof o !== 'object' || typeof o.storeHost !== 'string' || !/^\d{1,3}(\.\d{1,3}){3}$/.test(o.storeHost) || !privateIp(o.storeHost)) return false;
    var port = o.storePort === undefined ? 8777 : +o.storePort, nonce = String(o.n || '');
    if (!nonce || nonce === Prefs.storeNonce() || Math.floor(port) !== port || port < 1024 || port > 65535) return false;
    Prefs.set('storeNonce', nonce);
    Prefs.set('storeHost', o.storeHost + ':' + port);
    store.conn = 'none';
    return true;
  }

  function storeBase() {
    var m = /^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{2,5}))?$/.exec(Prefs.storeHost() || '');
    return m && privateIp(m[1]) ? 'http://' + m[1] + ':' + (m[2] || 8777) : '';
  }

  function storeCall(method, path, done) {
    var base = storeBase();
    if (!base) { done(new Error('no host')); return; }
    var x = new XMLHttpRequest(), over = false;
    x.open(method, base + path, true);
    x.timeout = 6000;
    x.setRequestHeader('X-FreeTV', '1');
    x.onreadystatechange = function () {
      if (x.readyState !== 4 || over) return;
      over = true;
      var json = null;
      try { json = JSON.parse(x.responseText); } catch (e) {}
      if (x.status >= 200 && x.status < 300 && json) done(null, json);
      else done(new Error(x.status === 0 ? 'no connection' : json && json.error ? json.error : 'HTTP ' + x.status), json);
    };
    x.ontimeout = x.onerror = function () { if (!over) { over = true; done(new Error('no connection')); } };
    x.send();
  }

  function communityShown() { return st.zone === Z.COMM; }

  /** Is the computer there? (Its answer redraws the screen.) */
  function storeCheck() {
    if (!storeBase()) { store.conn = 'none'; return; }
    store.conn = 'checking';
    storeCall('GET', '/ping', function (err, r) {
      store.conn = !err && r && r.service === 'freetv-community' ? 'ok' : 'off';
      if (communityShown()) renderCommunity();
    });
  }

  function storeInstall(app) {
    var flag = COMM_FLAG[app.id] || '';
    store.id = app.id;
    store.flow = 'working';
    store.phase = 'starting';
    store.message = store.note = '';
    store.misses = 0;
    renderCommunity();
    storeCall('POST', '/install?id=' + encodeURIComponent(app.id) + (flag ? '&flag=' + flag : ''), function (err) {
      if (err) { store.flow = 'failed'; store.message = err.message === 'no connection' ? tr('Sem conexão com o computador.', 'No connection to the computer.', 'Sin conexión con el ordenador.') : err.message; store.conn = 'off'; if (communityShown()) renderCommunity(); return; }
      storePoll(app);
    });
  }

  function storePoll(app) {
    clearTimeout(storeTimer);
    storeCall('GET', '/status', function (err, r) {
      if (err || !r) {
        // The computer may be busy for a moment; give up after a while.
        if (++store.misses > 10) { store.flow = 'failed'; store.message = tr('O computador parou de responder.', 'The computer stopped answering.', 'El ordenador dejó de responder.'); if (communityShown()) renderCommunity(); return; }
        storeTimer = setTimeout(function () { storePoll(app); }, 2000);
        return;
      }
      store.misses = 0;
      if (r.id !== app.id) { storeTimer = setTimeout(function () { storePoll(app); }, 1500); return; }
      store.phase = r.phase;
      store.note = r.note || '';
      if (r.phase === 'done') {
        store.flow = 'done';
        toast(app.title + ': ' + tr('instalada', 'installed', 'instalada'));
        loadApps(function () { renderShelf(); renderDrawer(); updateFocus(); });
      } else if (r.phase === 'failed') {
        store.flow = 'failed';
        store.message = r.message || '';
        toast(app.title + ': ' + tr('não foi instalada', 'was not installed', 'no se instaló'));
      } else storeTimer = setTimeout(function () { storePoll(app); }, 1500);
      if (communityShown()) renderCommunity();
    });
  }

  function openCommunity() {
    setClass($('settings'), 'open', false);
    st.zone = Z.COMM;
    st.comm = 0;
    commOpen = -1;
    commState = commList.length ? 'ready' : 'loading';
    renderCommunity();
    setClass($('community'), 'open', true);
    updateFocus();
    storeCheck();
    if (commList.length) return;
    Data.getJson(CATALOGUE, function (err, data) {
      if (err || !data || !data.packages) { commState = 'error'; renderCommunity(); return; }
      commList = data.packages.filter(function (p) { return p && p.id && p.manifest; }).sort(function (a, b) {
        var ra = a.manifest.rootRequired ? 1 : 0, rb = b.manifest.rootRequired ? 1 : 0;
        if (ra !== rb) return ra - rb;
        return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
      });
      commState = 'ready';
      renderCommunity();
    });
  }

  function line(box, cls, text) { return el('div', 'dtext' + (cls ? ' ' + cls : ''), box, text); }

  /** A button on the detail page; OK runs it. */
  function action(box, label, run) {
    var i = commActs.length, row = el('div', 'row', box, label);
    commActs.push(run);
    row.onmouseover = function () { if (st.zone === Z.COMM && commAct !== i) { commAct = i; updateFocus(); } };
    row.onclick = function () { commAct = i; updateFocus(); run(); };
  }

  function phaseText(phase) {
    return phase === 'downloading' ? tr('Baixando o pacote no computador…', 'Downloading the package on the computer…', 'Descargando el paquete en el ordenador…')
        : phase === 'verifying' ? tr('Conferindo o hash SHA-256…', 'Checking the SHA-256 hash…', 'Comprobando el hash SHA-256…')
        : phase === 'installing' ? tr('Instalando na TV…', 'Installing on the TV…', 'Instalando en la tele…')
        : tr('Preparando…', 'Getting ready…', 'Preparando…');
  }

  function renderDetail(box) {
    var a = commList[commOpen], m = a.manifest, req = a.requirements || {}, mine = store.id === a.id ? store.flow : 'idle';
    var warn = COMM_CAUTION[a.id], cmd = 'python3 tools/community.py serve <IP>';
    commActs = [];
    line(box, '', '').appendChild(el('b', '', null, a.title + '  ·  v' + (m.version || '?')));
    if (mine === 'asking') {
      line(box, '', tr('O computador baixa o pacote, confere o hash SHA-256 e instala na TV. Leva alguns minutos.',
          'Your computer downloads the package, checks its SHA-256 hash and installs it on the TV. It takes a few minutes.',
          'Tu ordenador descarga el paquete, comprueba su hash SHA-256 y lo instala en la tele. Tarda unos minutos.'));
      if (warn) line(box, 'warn', tr(warn[0], warn[1], warn[2]));
      var go = warn ? (COMM_FLAG[a.id] === 'official-removed' ? tr('Já apaguei o oficial: instalar', 'I deleted the official: install', 'Ya borré el oficial: instalar')
          : tr('Entendi o aviso: instalar', 'I understand: install', 'Entendido: instalar')) : tr('Instalar', 'Install', 'Instalar');
      var stop = tr('Cancelar', 'Cancel', 'Cancelar');
      // With a warning, OK lands on Cancel first.
      if (warn) { action(box, stop, function () { store.flow = 'idle'; commAct = 0; renderCommunity(); }); action(box, go, function () { storeInstall(a); }); }
      else { action(box, go, function () { storeInstall(a); }); action(box, stop, function () { store.flow = 'idle'; commAct = 0; renderCommunity(); }); }
    } else if (mine === 'working') {
      line(box, '', phaseText(store.phase));
      line(box, '', tr('Não desligue a TV nem o computador. Voltar deixa a instalação continuar.', 'Do not turn off the TV or the computer. Back lets the install carry on.', 'No apagues la tele ni el ordenador. Atrás deja que siga instalándose.'));
    } else if (mine === 'done' || mine === 'failed') {
      if (mine === 'done') line(box, '', tr('Pronto: instalada. Procure em «Todos os Apps».', 'Done: installed. Look for it in "All Apps".', 'Listo: instalada. Búscala en «Todas las apps».'));
      else line(box, 'warn', tr('Não foi possível instalar: ', 'Could not install: ', 'No se pudo instalar: ') + store.message);
      if (store.note) line(box, 'warn', store.note);
      action(box, mine === 'done' ? tr('Ver mais apps', 'Browse more apps', 'Ver más apps') : tr('Tentar de novo', 'Try again', 'Intentar de nuevo'), function () {
        store.flow = 'idle';
        if (mine === 'done') { commOpen = -1; }
        commAct = 0;
        renderCommunity();
        storeCheck();
      });
    } else {
      line(box, '', a.shortDescription || m.appDescription || '');
      line(box, '', tr('Precisa de: ', 'Needs: ', 'Necesita: ') + (req.webosRelease ? 'webOS ' + req.webosRelease : tr('nada especial', 'nothing special', 'nada especial')) +
          (req.deviceSoC ? ' · chip ' + req.deviceSoC.join(', ') : ''));
      if (warn) line(box, 'warn', tr(warn[0], warn[1], warn[2]));
      if (m.sourceUrl) line(box, '', tr('Código: ', 'Code: ', 'Código: ') + m.sourceUrl);
      if (m.rootRequired) line(box, 'warn', tr('Precisa de root: o FreeTV não instala isto.', 'Needs root: FreeTV does not install this.', 'Necesita root: FreeTV no la instala.'));
      else if (store.conn === 'ok' && store.flow === 'working') line(box, '', tr('Há outra instalação em andamento.', 'Another install is in progress.', 'Hay otra instalación en marcha.'));
      else if (store.conn === 'ok') {
        action(box, tr('Instalar nesta TV', 'Install on this TV', 'Instalar en esta tele'), function () {
          store.flow = 'asking'; store.id = a.id; commAct = 0; renderCommunity();
        });
      } else if (store.conn === 'checking') line(box, '', tr('Procurando o computador…', 'Looking for the computer…', 'Buscando el ordenador…'));
      else {
        line(box, '', store.conn === 'off' ? tr('Não encontro o computador. No computador, com o FreeTV instalado, execute:', 'Cannot reach the computer. On the computer, with FreeTV installed, run:', 'No encuentro el ordenador. En el ordenador, con FreeTV instalado, ejecuta:')
            : tr('Para instalar daqui, no computador execute:', 'To install from here, on the computer run:', 'Para instalar desde aquí, en el ordenador ejecuta:'));
        line(box, 'code', cmd);
        action(box, tr('Verificar de novo', 'Check again', 'Comprobar de nuevo'), function () { storeCheck(); renderCommunity(); });
      }
    }
    if (commAct >= commActs.length) commAct = 0;
    el('div', 'hint', box, tr('Voltar para a lista', 'Back to the list', 'Atrás vuelve a la lista'));
    updateFocus();
  }

  function renderCommunity() {
    var box = $('community').firstChild;
    box.innerHTML = '';
    var title = el('div', 'title', box);
    sym('apps', title);
    title.appendChild(document.createTextNode(commTitle()));
    if (commState !== 'ready') {
      line(box, '', commState === 'error' ? tr('Sem conexão com o catálogo agora.', 'No connection to the catalogue right now.', 'Sin conexión con el catálogo ahora mismo.')
          : tr('Carregando o catálogo…', 'Loading the catalogue…', 'Cargando el catálogo…'));
      updateFocus();
      return;
    }
    if (commOpen >= 0) { renderDetail(box); return; }
    el('div', 'hint', box, store.conn === 'ok'
        ? tr('Computador conectado: na ficha de cada app (sem root) dá para instalar.', 'Computer connected: each app without root can be installed from its page.', 'Ordenador conectado: en la ficha de cada app (sin root) se puede instalar.')
        : tr('Do catálogo webOS Homebrew. Para instalar daqui, conecte o computador (veja qualquer ficha).',
            'From the webOS Homebrew catalogue. To install from here, connect the computer (see any app page).',
            'Del catálogo webOS Homebrew. Para instalar desde aquí, conecta el ordenador (mira cualquier ficha).')).style.marginBottom = '14px';
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    list.style.height = Math.min(commList.length, 7) * 78 + 'px';
    for (var i = 0; i < commList.length; i++) {
      var p = commList[i], row = el('div', 'row', holder, p.title), v = el('span', 'value', row);
      var root = !!p.manifest.rootRequired;
      el('span', 'tag' + (root ? ' root' : ''), v, root ? 'root' : tr('sem root', 'no root', 'sin root'));
      hover(row, Z.COMM, i);
    }
    el('div', 'hint', box, tr('OK mostra os detalhes', 'OK shows the details', 'OK muestra los detalles'));
    updateFocus();
  }

  // MARK: - Suggestions: which services the picks come from, and how many

  function suggestRows() {
    var rows = [];
    Data.services().forEach(function (sv) {
      rows.push({label: sv.label, toggle: sv.on, step: function () { Data.setService(sv.key, !sv.on); }});
    });
    rows.push({label: tr('Animação e anime', 'Animation and anime', 'Animación y anime'), toggle: Data.animation(),
      step: function () { Data.setAnimation(!Data.animation()); }});
    var counts = [6, 9, 12, 18], n = Data.pickCount();
    rows.push({label: tr('Quantas mostrar', 'How many to show', 'Cuántas mostrar'), value: String(n),
      step: function (d) { Data.setPickCount(counts[(counts.indexOf(n) + (d || 1) + counts.length * 2) % counts.length]); }});
    return rows;
  }

  var suggestNow = [];

  function renderSuggest() {
    var box = $('suggest').firstChild;
    box.innerHTML = '';
    var title = el('div', 'title', box);
    sym('sparkles', title);
    title.appendChild(document.createTextNode(tr('Sugestões', 'Suggestions', 'Sugerencias')));
    el('div', 'hint', box, tr('Só se sugere o que está ligado: marque os serviços em que você tem conta.',
        'Only what is on is suggested: switch on the services where you have an account.',
        'Solo se sugiere lo que está activado: marca los servicios donde tienes cuenta.')).style.marginBottom = '14px';
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    suggestNow = suggestRows();
    list.style.height = Math.min(suggestNow.length, 7) * 78 + 'px';
    for (var i = 0; i < suggestNow.length; i++) {
      var r = suggestNow[i], row = el('div', 'row', holder, r.label);
      if (r.toggle !== undefined) setClass(el('div', 'toggle', row), 'on', r.toggle);
      else {
        var v = el('span', 'value', row);
        el('span', 'chev', v, '‹');
        v.appendChild(document.createTextNode(r.value));
        el('span', 'chev', v, '›');
      }
      hover(row, Z.SUGG, i);
    }
    el('div', 'hint', box, tr('OK liga ou desliga · ← → mudam o número', 'OK switches on or off · ← → change the number', 'OK activa o desactiva · ← → cambian el número'));
    updateFocus();
  }

  function openSuggest() {
    setClass($('settings'), 'open', false);
    st.zone = Z.SUGG;
    st.sug = 0;
    renderSuggest();
    setClass($('suggest'), 'open', true);
    updateFocus();
  }

  // MARK: - Shelf editor: which apps, in what order

  function ordinal(n) {
    if (I18N.lang === 'ru') return n + '-е';
    if (I18N.lang === 'de') return n + '.';
    if (I18N.lang !== 'en') return n + 'º';
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function editList() {
    var ids = shelf.map(function (a) { return a.id; });
    return {ids: ids, rows: apps.slice().sort(function (a, b) {
      var ia = ids.indexOf(a.id), ib = ids.indexOf(b.id);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
    })};
  }

  function renderShelfEdit() {
    var box = $('shelfedit').firstChild, e = editList();
    box.innerHTML = '';
    var title = el('div', 'title', box);
    sym('apps', title);
    title.appendChild(document.createTextNode(tr('Prateleira', 'Shelf', 'Estante')));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    list.style.height = Math.min(e.rows.length, 7) * 78 + 'px';
    for (var i = 0; i < e.rows.length; i++) {
      var a = e.rows[i], at = e.ids.indexOf(a.id), row = el('div', 'row', holder, a.title);
      el('span', 'value', row, at >= 0 ? tr('Na prateleira · ', 'On · ', 'En el estante · ') + ordinal(at + 1) : tr('Fora', 'Off', 'Fuera'));
      hover(row, Z.EDIT, i);
    }
    el('div', 'hint', box, tr('OK põe ou tira · ← → mudam a ordem', 'OK adds or removes · ← → change the order', 'OK pone o quita · ← → cambian el orden'));
    updateFocus();
  }

  function openShelfEdit() {
    setClass($('settings'), 'open', false);
    st.zone = Z.EDIT;
    st.edit = 0;
    renderShelfEdit();
    setClass($('shelfedit'), 'open', true);
    updateFocus();
  }

  function editShelf(dx) {
    var e = editList(), app = e.rows[st.edit];
    if (!app) return;
    var ids = e.ids.slice(), at = ids.indexOf(app.id);
    if (dx === 0) {
      if (at >= 0) ids.splice(at, 1);
      else if (ids.length < MAX_SHELF) ids.push(app.id);
      else { toast(tr('A prateleira cabe até ' + MAX_SHELF + ' apps.', 'The shelf holds up to ' + MAX_SHELF + ' apps.', 'El estante tiene hasta ' + MAX_SHELF + ' apps.')); return; }
    } else {
      if (at < 0) return;
      var to = Math.max(0, Math.min(ids.length - 1, at + dx));
      ids.splice(at, 1);
      ids.splice(to, 0, app.id);
    }
    Prefs.set('shelf', ids);
    pickShelf();
    renderShelf();
    var again = editList();
    for (var i = 0; i < again.rows.length; i++) if (again.rows[i].id === app.id) st.edit = i;
    renderShelfEdit();
  }

  // MARK: - Opening things

  function launcher(id, name) {
    return function () {
      TV.launch(id, null, function (ok) {
        if (!ok) toast(tr('Não deu para abrir ', "Couldn't open ", 'No se pudo abrir ') + (name || id));
      });
    };
  }

  function tvSettings() {
    TV.settings(function (ok) {
      if (!ok) toast(tr('Não deu para abrir os Ajustes da TV', "Couldn't open TV Settings", 'No se pudieron abrir los Ajustes del TV'));
    });
  }

  function liveTV() {
    for (var i = 0; i < inputs.length; i++) if (inputs[i].key === 'live') return inputs[i];
    return null;
  }

  function activate() {
    switch (st.zone) {
      case Z.TOP:
        if (st.top < 3) return;
        if (st.top === 3) { var live = liveTV(); if (live) launcher(live.id, tr('TV aberta', 'Live TV', 'TV en vivo'))(); }
        else if (st.top === 4) { st.zone = Z.SHELF; openDrawer(); st.drawer = 1 < drawerInputs ? 1 : 0; updateFocus(); }
        else openSettings();
        return;
      case Z.CARDS:
        var p = cards[st.card], app = p && Data.appFor(p.app);
        if (app) launcher(app.id, app.title)();
        return;
      case Z.SHELF:
        if (grabbed >= 0) { drop(); return; }
        if (shelf[st.shelf]) launcher(shelf[st.shelf].id, shelf[st.shelf].title)();
        return;
      case Z.DRAWER:
        if (drawerItems[st.drawer]) drawerItems[st.drawer].run();
        return;
      case Z.APPS:
        if (others[st.grid]) launcher(others[st.grid].id, others[st.grid].title)();
        return;
      case Z.SETTINGS:
        if (rowsNow[st.row]) { rowsNow[st.row].step(1); if (st.zone === Z.SETTINGS) renderSettings(); }
        return;
      case Z.EDIT:
        editShelf(0);
        return;
      case Z.COMM:
        if (commOpen < 0 && commList[st.comm]) { commOpen = st.comm; commAct = 0; renderCommunity(); }
        else if (commOpen >= 0 && commActs[commAct]) commActs[commAct]();
        return;
      case Z.SUGG:
        if (suggestNow[st.sug]) { var sr = suggestNow[st.sug]; sr.step(1); if (st.zone === Z.SUGG) renderSuggest(); }
        return;
    }
  }

  function selectTab(i) {
    if (i === st.tab) return;
    st.tab = i;
    renderCards();
  }

  function move(dx, dy) {
    var tiles = $('tiles').children, cardNodes = $('cards').children;
    switch (st.zone) {
      case Z.SHELF:
        if (grabbed >= 0) { if (dx) shift(dx); return; }   // a picked-up app only moves sideways
        if (dx) st.shelf = Math.max(0, Math.min(shelf.length - 1, st.shelf + dx));
        else if (dy > 0) { openDrawer(); return; }
        else if (dy < 0) {
          if (cards.length) { st.zone = Z.CARDS; st.card = nearest(cardNodes, centerX(tiles[st.shelf])); }
          else { st.zone = Z.TOP; st.top = st.tab; }
        }
        break;
      case Z.CARDS:
        if (dx) st.card = Math.max(0, Math.min(cards.length - 1, st.card + dx));
        else if (dy < 0) { st.zone = Z.TOP; st.top = st.tab; }
        else if (shelf.length) { st.zone = Z.SHELF; st.shelf = nearest(tiles, centerX(cardNodes[st.card])); }
        break;
      case Z.TOP:
        if (dx) {
          st.top = Math.max(0, Math.min(5, st.top + dx));
          if (st.top < 3) selectTab(st.top);   // as on Apple TV: focusing a tab selects it
        } else if (dy > 0) {
          if (cards.length) { st.zone = Z.CARDS; st.card = Math.min(cards.length - 1, st.top < 3 ? 0 : cards.length - 1); }
          else st.zone = Z.SHELF;
        }
        break;
      case Z.DRAWER:
        if (dx) st.drawer = Math.max(0, Math.min(drawerItems.length - 1, st.drawer + dx));
        else if (dy < 0) { closeDrawer(); return; }
        break;
      case Z.APPS:
        var g = st.grid + dx + dy * APP_COLS;
        if (g >= 0 && g < others.length && (dx === 0 || Math.floor(g / APP_COLS) === Math.floor(st.grid / APP_COLS))) st.grid = g;
        break;
      case Z.SETTINGS:
        if (dy) st.row = Math.max(0, Math.min(rowsNow.length - 1, st.row + dy));
        else if (dx && rowsNow[st.row]) {
          var r = rowsNow[st.row];
          if (r.value !== '›') { r.step(dx); renderSettings(); }
        }
        break;
      case Z.EDIT:
        if (dy) st.edit = Math.max(0, Math.min(apps.length - 1, st.edit + dy));
        else if (dx) editShelf(dx);
        break;
      case Z.COMM:
        if (commOpen < 0 && dy) st.comm = Math.max(0, Math.min(commList.length - 1, st.comm + dy));
        else if (commOpen >= 0 && dy) commAct = Math.max(0, Math.min(commActs.length - 1, commAct + dy));
        break;
      case Z.SUGG:
        if (dy) st.sug = Math.max(0, Math.min(suggestNow.length - 1, st.sug + dy));
        else if (dx && suggestNow[st.sug] && suggestNow[st.sug].toggle === undefined) { suggestNow[st.sug].step(dx); renderSuggest(); }
        break;
    }
    updateFocus();
  }

  function back() {
    if (grabbed >= 0) { drop(); return; }
    if (st.zone === Z.EDIT) { setClass($('shelfedit'), 'open', false); openSettings(); st.row = rowsNow.length - 2; updateFocus(); return; }
    if (st.zone === Z.COMM) {
      if (commOpen >= 0) {
        if (store.flow !== 'working') store.flow = 'idle';   // a running install carries on in the background
        commOpen = -1;
        renderCommunity();
        return;
      }
      setClass($('community'), 'open', false);
      openSettings();
      for (var c = 0; c < rowsNow.length; c++) if (rowsNow[c].label === commTitle()) st.row = c;
      updateFocus();
      return;
    }
    if (st.zone === Z.SUGG) {
      setClass($('suggest'), 'open', false);
      openSettings();
      for (var q = 0; q < rowsNow.length; q++) if (rowsNow[q].label === tr('Sugestões', 'Suggestions', 'Sugerencias')) st.row = q;
      updateFocus();
      return;
    }
    if (sheetOpen()) { closeSheets(); return; }
    if (st.zone === Z.DRAWER) { closeDrawer(); return; }
    if (st.zone !== Z.SHELF && shelf.length) { st.zone = Z.SHELF; updateFocus(); return; }
    TV.back();
  }

  /** The pointer focuses what it's over (the Magic Remote, or a mouse when previewing). */
  function hover(node, zone, index) {
    node.onmouseover = function () {
      if (saverOn || (sheetOpen() !== (zone === Z.APPS || zone === Z.SETTINGS || zone === Z.EDIT || zone === Z.SUGG || zone === Z.COMM))) return;
      if (zone === Z.DRAWER && st.zone !== Z.DRAWER) return;
      if (zone !== Z.DRAWER && st.zone === Z.DRAWER && zone !== Z.SHELF) return;
      if (zone === Z.SHELF && st.zone === Z.DRAWER) closeDrawer();
      st.zone = zone;
      if (zone === Z.TOP) { st.top = index; if (index < 3) selectTab(index); }
      else if (zone === Z.CARDS) st.card = index;
      else if (zone === Z.SHELF) st.shelf = index;
      else if (zone === Z.DRAWER) st.drawer = index;
      else if (zone === Z.APPS) st.grid = index;
      else if (zone === Z.SETTINGS) st.row = index;
      else if (zone === Z.EDIT) st.edit = index;
      else if (zone === Z.SUGG) st.sug = index;
      else if (zone === Z.COMM) st.comm = index;
      updateFocus();
    };
    node.onclick = function () { node.onmouseover(); activate(); };
  }

  // MARK: - Toast

  var toastTimer = 0;
  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    setClass(t, 'on', true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { setClass(t, 'on', false); }, 6000);
  }

  // MARK: - Night, clock, screensaver

  function checkNight() {
    setClass(body, 'night', Data.isNight(Date.now()));
  }

  var saverOn = false, idleAt = Date.now(), saverIndex = 0, saverTimer = 0, SAVER_AFTER = 5 * 60000;

  function showSaver() {
    var photos = Data.showcase().filter(function (p) { return p.backdrop && Data.appFor(p.app); });
    saverOn = true;
    var s = $('saver');
    s.innerHTML = '';
    var a = el('div', 'photo', s), b = el('div', 'photo', s);
    el('div', 'shade', s);
    var clock = el('div', 'clock', s);
    el('div', 'time', clock);
    el('div', 'date', clock);
    el('div', 'title', clock);
    var front = a;
    function next() {
      if (!saverOn) return;
      var p = photos.length ? photos[saverIndex++ % photos.length] : null;
      var back = front === a ? b : a;
      if (p) {
        back.style.backgroundImage = 'url(' + Data.image(p.backdrop, 'original') + ')';
        back.style.webkitTransform = back.style.transform = 'scale(1.0)';
        clock.lastChild.textContent = p.title;
        setTimeout(function () {
          setClass(back, 'on', true);
          setClass(front, 'on', false);
          back.style.webkitTransform = back.style.transform = 'scale(1.08) translateX(-1.5%)';
          front = back;
        }, 60);
      }
      tickSaverClock(clock);
      saverTimer = setTimeout(next, 12000);
    }
    setClass(s, 'on', true);
    next();
  }

  function tickSaverClock(clock) {
    var d = new Date();
    clock.firstChild.textContent = Data.time(d.getTime()).replace(/ (AM|PM)$/, '');
    try {
      clock.children[1].textContent = d.toLocaleDateString(I18N.locale(), {weekday: 'long', day: 'numeric', month: 'long'});
    } catch (e) {
      clock.children[1].textContent = d.toDateString();
    }
  }

  function hideSaver() {
    saverOn = false;
    clearTimeout(saverTimer);
    setClass($('saver'), 'on', false);
  }

  function poke() {
    idleAt = Date.now();
    if (saverOn) { hideSaver(); return true; }
    return false;
  }

  // MARK: - Moving apps on the shelf: hold OK on one, ◀ ▶ moves it, OK drops it

  var grabbed = -1, okDown = false, okHeld = false, okTimer = 0, OK_HOLD = 600;

  function grab(i) {
    if (!shelf[i]) return;
    grabbed = i;
    toast(tr('Mova com ◀ ▶ e solte com OK', 'Move it with ◀ ▶ and drop it with OK', 'Muévelo con ◀ ▶ y suéltalo con OK'));
    updateFocus();
  }

  function drop() {
    if (grabbed < 0) return;
    grabbed = -1;
    setClass($('toast'), 'on', false);
    updateFocus();
  }

  /** The grabbed app swaps places with its neighbour, and the new order is kept. */
  function shift(dx) {
    var to = grabbed + dx;
    if (to < 0 || to >= shelf.length) return;
    var app = shelf[grabbed], tiles = $('tiles'), a = tiles.children[grabbed], b = tiles.children[to], left = a.style.left;
    shelf.splice(grabbed, 1);
    shelf.splice(to, 0, app);
    a.style.left = b.style.left;
    b.style.left = left;
    if (dx > 0) tiles.insertBefore(b, a); else tiles.insertBefore(a, b);
    grabbed = st.shelf = to;
    Prefs.set('shelf', shelf.map(function (x) { return x.id; }));
    updateFocus();
  }

  // MARK: - Keys

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (poke()) { e.preventDefault(); return; }   // the first press only wakes the screen
    if (k === TV.keys.ok && st.zone === Z.SHELF) {
      // On the shelf OK acts when it is released, so that holding it can pick the app up instead of opening it.
      e.preventDefault();
      if (!okDown) {
        okDown = true;
        okHeld = false;
        if (grabbed >= 0) { okHeld = true; drop(); return; }
        clearTimeout(okTimer);
        okTimer = setTimeout(function () { okHeld = true; grab(st.shelf); }, OK_HOLD);
      }
      return;
    }
    if (k === TV.keys.left) move(-1, 0);
    else if (k === TV.keys.right) move(1, 0);
    else if (k === TV.keys.up) move(0, -1);
    else if (k === TV.keys.down) move(0, 1);
    else if (k === TV.keys.ok) activate();
    else if (k === TV.keys.back || k === 27 || k === 8) back();
    else return;
    e.preventDefault();
  });
  document.addEventListener('keyup', function (e) {
    if (e.keyCode !== TV.keys.ok) return;
    clearTimeout(okTimer);
    var pressed = okDown, held = okHeld;
    okDown = false;
    okHeld = false;
    if (pressed && !held && st.zone === Z.SHELF && grabbed < 0) activate();
  });
  document.addEventListener('mousemove', function () { poke(); });

  // MARK: - Start

  function renderAll() {
    renderTop();
    renderQuotes();
    cards = [];
    renderCards();
    renderShelf();
    renderDrawer();
    renderClock();
    checkNight();
    if (st.zone === Z.SETTINGS) renderSettings();
    updateFocus();
  }

  function loadApps(done) {
    TV.apps(function (list) {
      apps = list;
      Data.setApps(apps);
      pickShelf();
      TV.inputs(function (list2) {
        inputs = list2;
        if (done) done();
      });
    });
  }

  /** Back to the home screen (the app was opened again): the shelf, everything closed, the first tab. */
  function reset() {
    hideSaver();
    closeSheets();
    st.zone = Z.SHELF;
    st.shelf = 0;
    if (st.tab !== 0) { st.tab = 0; renderCards(); }
    updateFocus();
  }

  Data.onChange(function () {
    renderQuotes();
    renderCards();
    renderPanels();
    checkNight();
  });

  function reopened(e) {
    // LG: with handlesRelaunch the app has to come to the front itself, or opening it again while it runs shows nothing.
    if (window.PalmSystem && window.PalmSystem.activate) window.PalmSystem.activate();
    var toStore = takeStoreHost(e && e.detail) || takeStoreHost(window.PalmSystem && window.PalmSystem.launchParams);   // `community.py serve`
    reset();
    loadApps(function () { renderShelf(); renderDrawer(); Data.refresh(); if (toStore) openCommunity(); });
  }

  window.addEventListener('resize', fit);
  document.addEventListener('webOSRelaunch', reopened);   // LG: opened again while running
  window.addEventListener('appcontrol', reopened);        // Samsung: the same
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hideSaver(); return; }
    idleAt = Date.now();
    loadApps(function () { renderShelf(); renderDrawer(); updateFocus(); Data.refresh(); });
  });

  I18N.set(Prefs.language());
  fit();
  renderTop();
  var openedForStore = takeStoreHost(window.PalmSystem && window.PalmSystem.launchParams);   // started by `community.py serve`
  loadApps(function () {
    renderAll();
    Data.refresh();
    if (openedForStore) openCommunity();
  });
  setInterval(function () {
    renderClock();
    checkNight();
    Data.refresh();
    if (!saverOn && !sheetOpen() && Date.now() - idleAt > SAVER_AFTER) showSaver();
    if (saverOn) tickSaverClock($('saver').querySelector('.clock'));
  }, 30000);

  // For the browser preview and tests.
  window.FreeMyTV = {state: st, move: move, activate: activate, back: back, showSaver: showSaver, hideSaver: hideSaver, toast: toast,
    grab: grab, drop: drop, shelf: function () { return shelf; }};
})();
