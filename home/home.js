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

  // Is this the first run after an install? (its storage is empty: before anything of this page writes to it)
  var freshInstall = false;
  try { freshInstall = !localStorage.getItem('fmtv.prefs'); } catch (e) {}

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
    ['ytadfree', /^tizenbrew:npm\/@foxreis\/tizentube$/, /^youtube adfree$/i, ['#1C1C1E', '#09090A']],   // Samsung, through TizenBrew
    ['youtube', /youtube/, /^youtube$/i, ['#1C1C1E', '#09090A']],
    ['prime', /^amazon$/, /prime video|amazon/i, ['#2AA8FF', '#0A68D4']],
    ['disney', /disney/, /disney/i, ['#173584', '#08143F']],
    ['max', /hbo|wbd/, /^(hbo )?max$|hbo max/i, ['#5C30E8', '#221684']],
    ['twitch', /^tizenbrew:npm\/@jjg0\/twizen$/, /^twitch adfree$/i, ['#9146FF', '#4B1FA8']],   // Samsung, through TizenBrew
    ['live', /^com\.webos\.app\.livetv$/, /tv em direto|live tv|tv en directo/i, ['#2A8CFF', '#0A3FA8']],
    ['store', /^freetv\.store$/, /^(loja|store|tienda)$/i, ['#FF6B8A', '#E0245E']],
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
    if (app.tile) { el('img', 'ico', box).src = app.tile; return; }   // FreeTV's own full icons (tools/make_tiles.py)
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
    var chosen = Prefs.shelf(), out = [], hasStore = false, a0;
    for (a0 = 0; a0 < apps.length; a0++) if (apps[a0].id === 'freetv.store') hasStore = true;
    if (chosen && hasStore && !Prefs.storeOffered() && chosen.indexOf('freetv.store') < 0 && chosen.length < MAX_SHELF) {
      chosen = chosen.concat(['freetv.store']);   // a shelf saved before the Store existed gets its icon, at the end, once
      Prefs.set('shelf', chosen);
    }
    if (hasStore && !Prefs.storeOffered()) Prefs.set('storeOffered', true);
    // Samsung with TizenBrew: YouTube AdFree and Twitch AdFree come onto a saved shelf once (then they are the person's). YouTube AdFree
    // takes the official YouTube's place (same icon: both would look alike); the official one stays in All Apps.
    var brew = apps.filter(function (x) { return x.id.indexOf('tizenbrew:') === 0; }).map(function (x) { return x.id; });
    var adfree = brew.filter(function (id) { return /tizentube$/.test(id); })[0];
    if (chosen && brew.length && !Prefs.brewOffered()) {
      var official = chosen.filter(function (id) { return TV.youtube.indexOf(id) >= 0; })[0];
      if (official && adfree) chosen = chosen.map(function (id) { return id === official ? adfree : id; });
      chosen = chosen.concat(brew.filter(function (id) { return chosen.indexOf(id) < 0; }));
      if (chosen.length > MAX_SHELF) chosen = chosen.slice(chosen.length - MAX_SHELF);   // the new ones stay
      Prefs.set('shelf', chosen);
    }
    if (brew.length && !Prefs.brewOffered()) Prefs.set('brewOffered', true);
    if (chosen) {
      for (var i = 0; i < chosen.length && out.length < MAX_SHELF; i++) {
        for (var j = 0; j < apps.length; j++) if (apps[j].id === chosen[i]) out.push(apps[j]);
      }
    } else {
      for (var s = 0; s < SHELF.length && out.length < MAX_SHELF; s++) {
        if (SHELF[s][0] === 'youtube' && adfree) continue;   // YouTube AdFree is there instead (Samsung with TizenBrew)
        for (var a = 0; a < apps.length; a++) {
          if ((SHELF[s][1].test(apps[a].id) || SHELF[s][2].test(apps[a].title)) && out.indexOf(apps[a]) < 0) { out.push(apps[a]); break; }
        }
      }
      if (!out.length) out = apps.slice(0, MAX_SHELF);
    }
    if (Prefs.kids()) {
      out = out.filter(kidsAllowed);
      if (!out.length) out = apps.filter(kidsAllowed).slice(0, 1);
    }
    shelf = out;
    var hidden = Prefs.kids() ? apps.map(function (x) { return x.id; }) : Prefs.hiddenApps();
    others = apps.filter(function (x) { return hidden.indexOf(x.id) < 0; });   // All Apps lists every app, the ones on the shelf too, but the hidden ones
  }

  // MARK: - Focus

  var Z = {TOP: 'top', CARDS: 'cards', SHELF: 'shelf', DRAWER: 'drawer', APPS: 'apps', SETTINGS: 'settings', EDIT: 'edit', SUGG: 'suggest', COMM: 'community', TILES: 'tiles', DLG: 'dialog', INFO: 'info'};
  var st = {zone: Z.SHELF, top: 0, tab: firstTab(), card: 0, shelf: 0, drawer: 0, grid: 0, row: 0, edit: 0, sug: 0, comm: 0, tile: 0};
  var cards = [];

  function sheetOpen() { return st.zone === Z.APPS || st.zone === Z.SETTINGS || st.zone === Z.EDIT || st.zone === Z.SUGG || st.zone === Z.COMM || st.zone === Z.TILES || st.zone === Z.DLG || st.zone === Z.INFO; }

  function updateFocus() {
    var i, list;
    list = $('tabs').children;
    for (i = 0; i < list.length; i++) {
      setClass(list[i], 'on', VIS[i] === st.tab);
      setClass(list[i], 'focus', st.zone === Z.TOP && st.top === i);
    }
    list = $('buttons').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.TOP && st.top === TABS + i);
    setClass($('quotes'), 'hide', st.zone === Z.TOP && st.top >= TABS);
    list = $('cards').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.CARDS && st.card === i);
    if (st.zone === Z.CARDS) {
      // keep the focused card inside the screen, and let the blurred background follow it
      cardShift = st.card > 0 ? Math.max(0, cardLeft(st.card) + cardW(st.card) - 1840) : 0;
      $('cards').style.webkitTransform = $('cards').style.transform = cardShift ? 'translateX(' + (-cardShift) + 'px)' : '';
      if (cards[st.card] && cards[st.card] !== bgShown) { bgShown = cards[st.card]; backdrop(bgFor(cardBackdrop(bgShown))); }
    }
    list = $('tiles').children;
    for (i = 0; i < list.length; i++) {
      setClass(list[i], 'focus', st.zone === Z.SHELF && st.shelf === i);
      setClass(list[i], 'grab', grabbed === i);
    }
    list = $('tnames').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.SHELF && st.shelf === i);
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
    focusRows($('dialog'), dlg.index, st.zone === Z.DLG);
    focusRows($('infosheet'), info.index, st.zone === Z.INFO);
    list = document.querySelectorAll('#tilesheet .qtile');
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.TILES && st.tile === i);
    setClass(body, 'drawer-open', st.zone === Z.DRAWER);
  }

  function focusRows(sheet, index, on) {
    var rows = sheet.querySelectorAll('.row');
    for (var i = 0; i < rows.length; i++) setClass(rows[i], 'focus', on && i === index);
    var holder = sheet.querySelector('.rows');
    if (!holder) return;
    var pitch = +holder.getAttribute('data-pitch') || 78, visible = +holder.getAttribute('data-visible') || 7;
    var first = Math.max(0, Math.min(rows.length - visible, index - Math.floor(visible / 2)));
    holder.style.webkitTransform = holder.style.transform = 'translateY(' + (-first * pitch) + 'px)';
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

  // Five tabs: Custom (YouTube shortcuts for the children), Continue watching (what was opened from here), then the TMDB picks.
  var TABS = 5, TAB_KIND = [null, null, null, 'movie', 'tv'];

  /** How many tabs there are: all five, only the first two in calm mode, only the first in kids mode. */
  function tabCount() { return visTabs().length; }

  /** The tabs on the top row, in the person's order (Home Settings → Home → Tabs): calm mode keeps the first two, kids mode the first. */
  var VIS = [0, 1, 2, 3, 4];
  function visTabs() {
    if (Prefs.kids()) return [0];
    var hidden = Prefs.opt('tabHidden', []) || [], out = tabOrder().filter(function (t) { return hidden.indexOf(t) < 0 && (!Prefs.calm() || t < 2); });
    return out.length ? out : [Prefs.calm() ? 0 : tabOrder()[0]];
  }
  function localTab() { return st.tab < 2; }

  function frostWanted() {
    var m = Prefs.glass();
    if (m === 'off') return false;
    if (m === 'on') return true;
    var can = !!(window.CSS && CSS.supports && (CSS.supports('backdrop-filter', 'blur(2px)') || CSS.supports('-webkit-backdrop-filter', 'blur(2px)')));
    var ch = /Chrom(?:e|ium)\/(\d+)/.exec(navigator.userAgent || '');
    return can && (!ch || +ch[1] >= 76);
  }

  /** The look the person chose: frosted glass, calm mode, the accent colour, and the tabs that go with them. */
  function applyLook() {
    setClass(body, 'frost', frostWanted());
    setClass(body, 'calm', Prefs.calm());
    setClass(body, 'kids', Prefs.kids());
    ACCENTS.forEach(function (a) { setClass(body, 'acc-' + a, Prefs.accent() === a); });
    setClass(body, 'lessmotion', Prefs.opt('motion', 'normal') === 'less');
    setClass(body, 'notopclock', Prefs.opt('topClock', true) === false);
    setClass(body, 'bigtext', Prefs.opt('textSize', 'normal') === 'large');
    ['clear', 'solid'].forEach(function (g) { setClass(body, 'glass-' + g, Prefs.opt('glassLevel', 'normal') === g); });
    ['rounder', 'square'].forEach(function (c) { setClass(body, 'corners-' + c, Prefs.opt('corners', 'round') === c); });
    ['oled', 'light', 'warm', 'minimal'].forEach(function (l) { setClass(body, 'look-' + l, Prefs.opt('look', '') === l); });
    var small = Prefs.opt('cardSize', 'normal') === 'small';
    if (small !== hasClass(body, 'smallcards')) {
      setClass(body, 'smallcards', small);
      HERO_W = small ? 860 : 1040;
      SMALL_W = small ? 262 : 320;
      LOCAL_W = small ? 280 : 340;
      cards = [];
      renderCards();
    }
    renderTitle();
    var vis = visTabs();
    if (vis.join() !== VIS.join()) {
      VIS = vis;
      TABS = vis.length;
      if (VIS.indexOf(st.tab) < 0) { st.tab = VIS[0]; renderCards(); }
      if (st.zone === Z.TOP && st.top >= TABS && st.top < 5) st.top = 0;
      renderTop();
    }
  }

  /** What is behind the home: the focused card's picture, or one of the landscapes (a new one every half hour). */
  function bgFor(url) {
    if (Prefs.wallpaper() === 'plain') return '';
    if (Prefs.wallpaper() === 'url') return Prefs.opt('wallUrl', '') || url;
    var places = landscapes();
    if (Prefs.wallpaper() !== 'places' || !places.length) return url;
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(places[Math.floor(Date.now() / 1800000) % places.length][0]) + '?width=480';
  }

  function refreshBackdrop() { bgUrl = null; backdrop(bgFor(bgShown ? cardBackdrop(bgShown) : '')); }

  /** The tab to open on: the person's choice, or the one they used last. */
  function firstTab() { var t = Prefs.startTab(), v = visTabs(); t = t === 'last' ? Prefs.lastTab() : t; return v.indexOf(t) >= 0 ? t : v[0]; }

  function tabNames() {
    var own = Prefs.opt('tabNames', {}) || {}, names = [tr('Personalizado', 'Custom', 'Personalizado'), tr('Continuar assistindo', 'Continue watching', 'Continuar viendo'),
      tr('Explorar', 'Explore', 'Explorar'), tr('Filmes', 'Movies', 'Películas'), tr('Séries', 'Shows', 'Series')];
    return names.map(function (n, i) { return own[i] || n; });
  }

  /** Hold OK on a tab: make it the one FreeTV opens on (or the last one used). */
  function openTabMenu(i) {
    var names = tabNames();
    showDialog(names[i], [{text: tr('Em qual aba o FreeTV abre ao ligar a TV?', 'Which tab should FreeTV open on when the TV is turned on?', '¿En qué pestaña debe abrirse FreeTV al encender la tele?')}], [
      {label: tr('Esta aba: ', 'This tab: ', 'Esta pestaña: ') + names[i], run: function () { Prefs.set('startTab', i); toast(names[i] + ': ' + tr('aba inicial', 'start tab', 'pestaña de inicio')); }},
      {label: tr('A última que usei', 'The last one I used', 'La última que usé'), run: function () { Prefs.set('startTab', 'last'); Prefs.set('lastTab', st.tab); }},
      {label: tr('Renomear esta aba', 'Rename this tab', 'Renombrar esta pestaña'), run: function () { renameTab(i); }},
      {label: tr('Organizar as abas…', 'Arrange the tabs…', 'Ordenar las pestañas…'), run: function () { openInfo('tabs'); }},
      {label: cancelText()}
    ], 0);
  }

  /** The big title: "For You", or a greeting for the time of day, with the person's name if they gave one. */
  function renderTitle() {
    var mode = Prefs.opt('titleMode', 'tab'), name = String(Prefs.opt('name', '') || '');
    if (mode !== 'greet') { $('title').textContent = tr('Para você', 'For You', 'Para ti'); return; }
    var h = new Date().getHours();
    var g = h >= 6 && h < 13 ? tr('Bom dia', 'Good morning', 'Buenos días') : h >= 13 && h < 20 ? tr('Boa tarde', 'Good afternoon', 'Buenas tardes')
        : tr('Boa noite', 'Good evening', 'Buenas noches');
    $('title').textContent = name ? g + ', ' + name : g;
  }

  /** The name the greeting uses, typed with the TV's keyboard. */
  function askName() {
    showDialog.icon = 'home';
    showDialog(tr('Seu nome', 'Your name', 'Tu nombre'), [
      {text: tr('Para a saudação do título. Escreva com o teclado da TV e aperte Enter.', 'For the greeting in the title. Type with the TV keyboard and press Enter.',
        'Para el saludo del título. Escríbelo con el teclado de la tele y pulsa Intro.')}
    ], [{label: tr('Guardar', 'Save', 'Guardar'), run: function () { saveName(input.value); }},
        {label: tr('Sem nome', 'No name', 'Sin nombre'), run: function () { saveName(''); }}, {label: cancelText()}], 0);
    var box = $('dialog').firstChild, input = document.createElement('input');
    input.type = 'text';
    input.className = 'chaninput';
    input.maxLength = 24;
    input.value = Prefs.opt('name', '');
    input.onEnter = function (v) { saveName(v); closeSheets(); };
    box.insertBefore(input, box.querySelector('.row'));
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 250);
  }

  function saveName(v) {
    Prefs.set('name', String(v || '').replace(/^\s+|\s+$/g, '').slice(0, 24));
    if (Prefs.opt('name', '') && Prefs.opt('titleMode', 'tab') !== 'greet') Prefs.set('titleMode', 'greet');
    renderTitle();
  }

  function renderTop() {
    renderTitle();
    var tabs = $('tabs');
    tabs.innerHTML = '';
    var names = tabNames();
    for (var i = 0; i < TABS; i++) {
      var t = el('button', 'tab', tabs, names[VIS[i]]);
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
      hover(r, Z.TOP, TABS + b);
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
    if (Prefs.quotes()) tickers().forEach(function (t) {
      var d = quoteData[t.k + ':' + t.s];
      if (!t.top || !d) return;
      var it = el('span', 'q', q);
      el('b', '', it, (t.n || t.s).slice(0, 10).toUpperCase());
      el('span', '', it, Data.compact(d.price));
    });
  }

  // MARK: - Picks and background

  // One wide card, then as many tall ones as there are picks; the row slides sideways to keep the focused one in view.
  var HERO_W = 1040, SMALL_W = 320, LOCAL_W = 340, CARD_GAP = 40, cardShift = 0, bgShown = null;
  function cardW(c) { return localTab() ? LOCAL_W : (c === 0 ? HERO_W : SMALL_W); }
  function cardLeft(c) {
    if (localTab()) return 80 + c * (LOCAL_W + CARD_GAP);   // all the same size
    return c === 0 ? 80 : 80 + HERO_W + CARD_GAP + (c - 1) * (SMALL_W + CARD_GAP);
  }

  /** The installed YouTube the channels open in (TV.youtube: YouTube AdFree on LG, Samsung's YouTube), or null. */
  function youtubeApp() {
    for (var i = 0; i < TV.youtube.length; i++) if (findApp(TV.youtube[i])) return TV.youtube[i];
    return null;
  }

  function findApp(id) {
    for (var i = 0; i < apps.length; i++) if (apps[i].id === id) return apps[i];
    return null;
  }

  /** The Custom tab: one cover per YouTube shortcut (kids_channels.py puts the pictures there), then "+" (LG). */
  /** The shortcuts in the person's order, without the ones they took away; new ones from the configuration go at the end. */
  /** The shortcuts from the configuration (kids_channels.py) and the ones added on the TV. */
  function allChannels() { return ((window.CONFIG && CONFIG.channels) || []).concat(Prefs.chanExtra()); }

  function channelList() {
    var all = allChannels(), hidden = Prefs.chanHidden(), order = Prefs.chanOrder(), out = [], i, j;
    for (i = 0; i < order.length; i++) {
      for (j = 0; j < all.length; j++) if (all[j].key === order[i] && out.indexOf(all[j]) < 0 && hidden.indexOf(all[j].key) < 0) out.push(all[j]);
    }
    for (j = 0; j < all.length; j++) if (out.indexOf(all[j]) < 0 && hidden.indexOf(all[j].key) < 0) out.push(all[j]);
    return out;
  }

  function channelItems() {
    var list = channelList(), out = [];
    for (var i = 0; i < list.length; i++) out.push(channelCard(list[i], ''));
    // "+" searches YouTube from the TV through FreeTV's service, which only LG has.
    if (TV.name === 'webos') out.push({local: 'plus', id: 'plus', title: tr('Adicionar canal', 'Add a channel', 'Añadir canal'), meta: ''});
    return out;
  }

  function channelCard(c, meta) {
    return {local: 'channel', id: 'chan:' + c.key, title: c.title, thumb: c.thumb || '', meta: meta || 'YouTube', chan: c};
  }

  function agoText(at) {
    var m = Math.max(1, Math.round((Date.now() - at) / 60000));
    if (m < 60) return tr('há ' + m + ' min', m + ' min ago', 'hace ' + m + ' min');
    var h = Math.round(m / 60);
    if (h < 48) return tr('há ' + h + ' h', h + ' h ago', 'hace ' + h + ' h');
    var d = Math.round(h / 24);
    return tr('há ' + d + ' d', d + ' d ago', 'hace ' + d + ' d');
  }

  /** "Continue watching": what was opened from FreeTV, newest first. (The TV does not tell an app what other apps played.) */
  function recentItems() {
    var list = Prefs.recent(), out = [];
    for (var i = 0; i < list.length && out.length < 12; i++) {
      var r = list[i], meta = agoText(r.at || 0), j;
      if (r.id.indexOf('chan:') === 0) {
        var chans = allChannels();
        for (j = 0; j < chans.length; j++) if ('chan:' + chans[j].key === r.id) out.push(channelCard(chans[j], 'YouTube · ' + meta));
      } else {
        var app = findApp(r.id.slice(4));
        if (app) out.push({local: 'app', id: r.id, title: app.title, thumb: app.icon || '', color: app.color || '', meta: meta, app: app});
      }
    }
    if (!out.length) out.push({local: 'hint', id: 'hint', title: tr('Ainda nada', 'Nothing yet', 'Todavía nada'),
      meta: tr('O que você abrir daqui aparece aqui.', 'What you open from here shows up here.', 'Lo que abras desde aquí aparece aquí.')});
    return out;
  }

  /** Remembers what was opened (an app or a shortcut), for the Continue watching tab. */
  function remember(id, title) {
    var list = Prefs.recent().filter(function (x) { return x.id !== id; });
    list.unshift({id: id, title: title, at: Date.now()});
    Prefs.set('recent', list.slice(0, 12));
    if (st.tab === 1) renderCards();
  }

  function tabItems() {
    if (st.tab === 0) return channelItems();
    if (st.tab === 1) return recentItems();
    return Data.picks(TAB_KIND[st.tab]);
  }

  function cardSig(p) { return [p.local || '', p.id, p.title, p.thumb || '', p.backdrop || '', p.meta || '', p.service || ''].join('|'); }

  function cardBackdrop(p) {
    if (p.local) return p.thumb || '';
    return Data.image(p.backdrop, 'w300');
  }

  function renderCards() {
    var list = tabItems();
    var holder = $('cards');
    setClass(body, 'no-picks', !list.length);
    var same = list.length === cards.length;
    for (var i = 0; same && i < list.length; i++) same = cardSig(list[i]) === cardSig(cards[i]);
    if (same && holder.children.length === list.length) return;
    cards = list;
    holder.innerHTML = '';
    cardShift = 0;
    holder.style.webkitTransform = holder.style.transform = '';
    for (var c = 0; c < list.length; c++) {
      var p = list[c], card = el('div', 'card', holder);
      card.style.left = cardLeft(c) + 'px';
      card.style.width = cardW(c) + 'px';
      var img = el('div', 'img', card);
      if (p.local) {
        setClass(card, 'sq', true);
        if (p.thumb) img.style.backgroundImage = 'url(' + p.thumb + ')';
        else {
          if (p.local === 'plus') setClass(img, 'plus', true);
          else img.style.backgroundColor = p.color || '#5B5F6B';
          el('div', 'word', img, p.local === 'plus' ? '+' : p.title);
        }
        el('div', 'name', card, p.title);
        if (p.meta) el('div', 'meta', card, p.meta);
        hover(card, Z.CARDS, c);
        continue;
      }
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
    backdrop(bgFor(list.length ? cardBackdrop(list[0]) : ''));
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

  // The small clock left of the round buttons, set again right as each minute starts.
  var topClockTimer = 0;
  function tickTopClock() {
    clearTimeout(topClockTimer);
    var now = new Date(), c = $('topclock'), date = '';
    if (Prefs.opt('topDate', false)) {
      try { date = now.toLocaleDateString(I18N.locale(), {weekday: 'short', day: 'numeric', month: 'short'}); } catch (e) { date = now.toDateString().slice(0, 10); }
    }
    c.innerHTML = '';
    if (date) el('span', 'tdate', c, date);
    c.appendChild(document.createTextNode(Data.time(now.getTime())));
    if (Prefs.opt('titleMode', 'tab') === 'greet') renderTitle();
    topClockTimer = setTimeout(tickTopClock, 60000 - Date.now() % 60000 + 50);
  }

  function renderClock() {
    tickTopClock();
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
    var tw = Math.min(Prefs.opt('iconSize', 'normal') === 'small' ? 112 : 140, (1760 - Math.max(0, n - 1) * gap) / Math.max(1, n)), th = tw;
    var width = n * tw + Math.max(0, n - 1) * gap, left = (1920 - width) / 2;
    var platter = $('platter');
    platter.style.display = n ? '' : 'none';
    platter.style.left = (left - pad) + 'px';
    platter.style.width = (width + 2 * pad) + 'px';
    platter.style.top = (814 + SHELF_DROP + 126 - th) + 'px';
    platter.style.height = (th + 2 * pad) + 'px';
    $('quotes').style.right = Math.min(1920 - left - width, 154) + 'px';   // in line with the shelf, never closer to the tabs than with normal icons
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
    var names = $('tnames'), mode = Prefs.opt('iconNames', 'none');
    names.innerHTML = '';
    if (mode !== 'none') {
      for (var ni = 0; ni < n; ni++) {
        var lab = el('div', 'tname' + (mode === 'focus' ? ' only' : ''), names, shelf[ni].title);
        lab.style.left = (left + ni * (tw + gap) - 20) + 'px';
        lab.style.width = (tw + 40) + 'px';
        lab.style.top = (854 + SHELF_DROP + 126 + 12) + 'px';
      }
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
      drawerItems.push({label: inputLabel(x), symbol: x.key === 'live' ? x.symbol : inputKind(x.id)[2] || x.symbol, off: !x.connected, run: launcher(x.id, inputLabel(x))});
    }
    drawerInputs = drawerItems.length;
    var recentN = 0;
    if (Prefs.opt('drawerRecent', true) !== false && !Prefs.kids()) {
      Prefs.recent().forEach(function (r) {
        if (recentN >= 2 || r.id.indexOf('app:') !== 0) return;
        var app = findApp(r.id.slice(4));
        if (!app || shelf.indexOf(app) >= 0) return;
        recentN++;
        drawerItems.push({label: app.title, symbol: 'play', run: launcher(app.id, app.title), recent: true});
      });
    }
    if (!Prefs.kids()) drawerItems.push({label: tr('Painel rápido', 'Quick panel', 'Panel rápido'), symbol: 'sparkles', run: function () { openTiles('quick'); }});
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
      if (recentN && k === drawerInputs && k > 0) d.lastChild.textContent = tr('Recentes e atalhos', 'Recent and shortcuts', 'Recientes y accesos');
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
    settingsCat = null;
    setClass($('apps'), 'open', false);
    setClass($('settings'), 'open', false);
    setClass($('shelfedit'), 'open', false);
    setClass($('suggest'), 'open', false);
    setClass($('community'), 'open', false);
    setClass($('tilesheet'), 'open', false);
    setClass($('infosheet'), 'open', false);
    setClass($('dialog'), 'open', false);
    st.zone = Z.SHELF;
    updateFocus();
  }

  // MARK: - Home Settings

  var settingsCat = null, settingsCatRow = 0;

  function settingCats() {
    var cats = [
      {id: 'home', icon: 'home', label: tr('Início', 'Home', 'Inicio')},
      {id: 'look', icon: 'sparkles', label: tr('Aparência', 'Look', 'Aspecto')},
      {id: 'widgets', icon: 'partly_cloudy_day', label: tr('Widgets', 'Widgets', 'Widgets')},
      {id: 'apps', icon: 'apps', label: tr('Apps', 'Apps', 'Apps')},
      {id: 'quick', icon: 'tiles', label: tr('Painel rápido', 'Quick panel', 'Panel rápido')},
      {id: 'remote', icon: 'gamepad', label: tr('Controle remoto', 'Remote', 'Mando')}
    ];
    cats.push({id: 'privacy', icon: 'lock', label: tr('Privacidade e crianças', 'Privacy and kids', 'Privacidad y niños')});
    cats.push({id: 'care', icon: 'settings', label: tr('Manutenção', 'Maintenance', 'Mantenimiento')});
    return cats;
  }

  // Ready-made styles: each sets a few choices at once (the person can change any of them after).
  var LOOKS = {
    '': null,
    oled: {theme: 'dark', accent: 'blue', wallpaper: 'plain', glassLevel: 'solid'},
    light: {theme: 'light', accent: 'mint', wallpaper: 'cards', glassLevel: 'clear'},
    warm: {theme: 'dark', accent: 'amber', wallpaper: 'places', glassLevel: 'normal'},
    minimal: {theme: 'auto', accent: 'sky', wallpaper: 'plain', calm: true, iconSize: 'small', topDate: false}
  };
  function lookName(l) {
    return {'': tr('Nenhum', 'None', 'Ninguno'), oled: tr('OLED preto puro', 'Pure black OLED', 'OLED negro puro'), light: tr('Vidro claro', 'Clear glass', 'Cristal claro'),
      warm: tr('Noite quente', 'Warm night', 'Nocturno cálido'), minimal: tr('Minimalista', 'Minimal', 'Minimalista')}[l] || l;
  }
  function applyPreset(d) {
    var keys = ['', 'oled', 'light', 'warm', 'minimal'], now = Prefs.opt('look', ''), next = keys[(keys.indexOf(now) + (d || 1) + keys.length) % keys.length];
    Prefs.set('look', next);
    var set = LOOKS[next];
    if (set) for (var k in set) if (set.hasOwnProperty(k)) Prefs.set(k, set[k]);
    applyLook();
    checkNight();
    refreshBackdrop();
    renderShelf();
  }
  function regionName(r) {
    return {all: tr('Todos os lugares', 'Everywhere', 'Todos los sitios'), andalucia: 'Andalucía', spain: tr('Espanha', 'Spain', 'España'), lithuania: tr('Lituânia', 'Lithuania', 'Lituania')}[r] || r;
  }
  /** The landscapes of the region the person chose. */
  function landscapes() {
    if (typeof LANDSCAPES === 'undefined') return [];
    var r = Prefs.opt('placesRegion', 'all');
    return LANDSCAPES.filter(function (p) {
      var place = String(p[1]);
      return r === 'all' || (r === 'lithuania' ? /lit/i.test(place) : r === 'andalucia' ? /sevilla|andaluc/i.test(place) : !/lit/i.test(place));
    });
  }
  function askWall() {
    askText(tr('Foto de fundo', 'Background picture', 'Foto de fondo'), tr('O endereço https de uma imagem (JPG ou PNG).', 'The https address of a picture (JPG or PNG).', 'La dirección https de una imagen (JPG o PNG).'),
      Prefs.opt('wallUrl', ''), function (v) {
        if (!/^https:\/\//.test(trim(v))) { toast(tr('Precisa começar com https://', 'It must start with https://', 'Tiene que empezar por https://')); return; }
        Prefs.set('wallUrl', trim(v));
        Prefs.set('wallpaper', 'url');
        refreshBackdrop();
      }, 'https://');
  }
  function askImmich() {
    askText(tr('Álbum do Immich', 'Immich album', 'Álbum de Immich'), tr('O link compartilhado do álbum (https://seu-servidor/share/…).', 'The album\'s shared link (https://your-server/share/…).',
      'El enlace compartido del álbum (https://tu-servidor/share/…).'), Prefs.opt('immichUrl', ''), function (v) {
        if (!/^https:\/\/[^\/]+\/share\/[\w-]+/.test(trim(v))) { toast(tr('Não parece um link compartilhado do Immich', 'That does not look like an Immich shared link', 'No parece un enlace compartido de Immich')); return; }
        Prefs.set('immichUrl', trim(v));
        cache('saver.immich', null);
      }, 'https://');
  }

  function accentNames() {
    return {mint: tr('Menta', 'Mint', 'Menta'), blue: tr('Azul', 'Blue', 'Azul'), violet: tr('Violeta', 'Violet', 'Violeta'), rose: tr('Rosa', 'Rose', 'Rosa'),
      orange: tr('Laranja', 'Orange', 'Naranja'), amber: tr('Âmbar', 'Amber', 'Ámbar'), sky: tr('Céu', 'Sky', 'Cielo')};
  }

  function settingsTitle() {
    var main = tr('Ajustes do Início', 'Home Settings', 'Ajustes de inicio');
    if (!settingsCat) return main;
    var c = settingCats().filter(function (x) { return x.id === settingsCat; })[0];
    return c ? c.label : main;
  }

  function settingRows() {
    if (!settingsCat) {
      return settingCats().map(function (c) {
        return {label: c.label, icon: c.icon, value: '›', step: function (d) { if (d >= 0) { settingsCatRow = st.row; settingsCat = c.id; st.row = 0; renderSettings(); } }};
      });
    }
    var lang = Prefs.language(), unit = Prefs.temperature(), theme = Prefs.theme();
    var auto = tr('Automático', 'Automatic', 'Automático'), on = tr('Ligado', 'On', 'Activado'), off = tr('Desligado', 'Off', 'Desactivado');
    var rows = [];
    if (settingsCat === 'home') {
      rows.push({label: tr('Idioma', 'Language', 'Idioma'), value: lang === 'ru' ? 'Русский' : lang === 'de' ? 'Deutsch' : lang === 'pt' ? 'Português' : lang === 'en' ? 'English' : lang === 'es' ? 'Español' : auto,
        step: function (d) { cycle('language', ['auto', 'de', 'en', 'es', 'pt', 'ru'], lang, d); I18N.set(Prefs.language()); renderAll(); }});
      if (window.HomeExtras && window.HomeExtras.homeRows) rows = rows.concat(window.HomeExtras.homeRows());   // LG: the Home button
      rows.push({label: tr('Aba inicial', 'Start tab', 'Pestaña de inicio'), value: Prefs.startTab() === 'last' ? tr('A última usada', 'The last used', 'La última usada') : tabNames()[Prefs.startTab()],
        step: function (d) { cycle('startTab', [0, 1, 2, 3, 4, 'last'], Prefs.startTab(), d); }});
      rows.push({label: tr('Prateleira', 'Shelf', 'Estante'), value: '›', step: function (d) { if (d >= 0) openShelfEdit(); }});
      rows.push({label: tr('Abas', 'Tabs', 'Pestañas'), value: '›', step: function (d) { if (d >= 0) openInfo('tabs'); }});
      rows.push({label: tr('Perfis', 'Profiles', 'Perfiles'), value: profileName(profileNow()), step: function (d) { if (d >= 0) openInfo('profiles'); }});
      rows.push({label: tr('Rotinas', 'Routines', 'Rutinas'), value: String(routines().length), step: function (d) { if (d >= 0) openInfo('routines'); }});
      rows.push({label: tr('Sugestões', 'Suggestions', 'Sugerencias'), value: '›', step: function (d) { if (d >= 0) openSuggest(); }});
      var modes = ['both', 'places', 'picks', 'potd', 'apod', 'immich', 'clock'], names = {
        both: tr('Paisagens e sugestões', 'Places and picks', 'Paisajes y sugerencias'),
        places: tr('Paisagens', 'Places', 'Paisajes'),
        picks: tr('Sugestões', 'Picks', 'Sugerencias'),
        potd: tr('Foto do dia (Wikimedia)', 'Picture of the day (Wikimedia)', 'Foto del día (Wikimedia)'),
        apod: tr('Astronomia (NASA)', 'Astronomy (NASA)', 'Astronomía (NASA)'),
        immich: tr('Minhas fotos (Immich)', 'My photos (Immich)', 'Mis fotos (Immich)'),
        clock: tr('Relógio grande', 'Big clock', 'Reloj grande')};
      rows.push({label: tr('Protetor de tela', 'Screensaver', 'Salvapantallas'), value: names[Data.saver()],
        step: function (d) { Data.setSaver(modes[(modes.indexOf(Data.saver()) + (d || 1) + modes.length * 2) % modes.length]); }});
      var after = Prefs.opt('saverAfter', 2);
      rows.push({label: tr('Protetor de tela depois de', 'Screensaver after', 'Salvapantallas tras'),
        value: after ? tr(after + ' min', after + ' min', after + ' min') : tr('Nunca', 'Never', 'Nunca'),
        step: function (d) { cycle('saverAfter', [1, 2, 5, 10, 15, 30, 0], after, d); }});
      rows.push({label: tr('Relógio no protetor de tela', 'Clock on the screensaver', 'Reloj en el salvapantallas'), toggle: Prefs.opt('saverClock', true) !== false,
        step: function () { Prefs.set('saverClock', Prefs.opt('saverClock', true) === false); }});
      if (Data.saver() === 'immich') rows.push({label: tr('Álbum do Immich', 'Immich album', 'Álbum de Immich'), value: Prefs.opt('immichUrl', '') ? '✓' : '›', step: function (d) { if (d >= 0) askImmich(); }});
      rows.push({label: tr('Clima no protetor de tela', 'Weather on the screensaver', 'Tiempo en el salvapantallas'), toggle: Prefs.opt('saverWeather', true) !== false,
        step: function () { Prefs.set('saverWeather', Prefs.opt('saverWeather', true) === false); }});
      rows.push({label: tr('Mais suave à noite', 'Dimmer at night', 'Más tenue de noche'), toggle: Prefs.opt('saverDim', true) !== false,
        step: function () { Prefs.set('saverDim', Prefs.opt('saverDim', true) === false); }});
      if (TV.name === 'webos') {
        var off = +Prefs.opt('screenOff', 0);
        rows.push({label: tr('Apagar a tela depois de', 'Screen off after', 'Apagar la pantalla tras'), value: off ? off + ' min' : tr('Nunca', 'Never', 'Nunca'),
          step: function (d) { cycle('screenOff', [0, 10, 30, 60], off, d); }});
      }
    } else if (settingsCat === 'look') {
      rows.push({label: tr('Estilo pronto', 'Ready-made style', 'Estilo listo'), value: lookName(Prefs.opt('look', '')), step: function (d) { applyPreset(d); }});
      rows.push({label: tr('Tema', 'Theme', 'Tema'), value: theme === 'light' ? tr('Claro', 'Light', 'Claro') : theme === 'dark' ? tr('Escuro', 'Dark', 'Oscuro') : theme === 'schedule' ? tr('Escuro por horário', 'Dark by schedule', 'Oscuro por horario') : auto,
        step: function (d) { cycle('theme', ['auto', 'light', 'dark', 'schedule'], theme, d); checkNight(); }});
      if (theme === 'schedule') {
        rows.push({label: tr('   escuro a partir das', '   dark from', '   oscuro desde las'), value: pad2(+Prefs.opt('darkFrom', 21)) + ':00', step: function (d) { Prefs.set('darkFrom', (+Prefs.opt('darkFrom', 21) + (d || 1) + 24) % 24); checkNight(); }});
        rows.push({label: tr('   até as', '   until', '   hasta las'), value: pad2(+Prefs.opt('darkTo', 8)) + ':00', step: function (d) { Prefs.set('darkTo', (+Prefs.opt('darkTo', 8) + (d || 1) + 24) % 24); checkNight(); }});
      }
      rows.push({label: tr('Vidro fosco', 'Frosted glass', 'Cristal esmerilado'), value: Prefs.glass() === 'on' ? on : Prefs.glass() === 'off' ? off : auto,
        step: function (d) { cycle('glass', ['auto', 'on', 'off'], Prefs.glass(), d); applyLook(); }});
      rows.push({label: tr('Cor de destaque', 'Accent colour', 'Color de acento'), value: accentNames()[Prefs.accent()],
        step: function (d) { cycle('accent', ACCENTS, Prefs.accent(), d); applyLook(); }});
      var walls = {cards: tr('A capa em foco', 'The focused cover', 'La portada en foco'), places: tr('Paisagens', 'Landscapes', 'Paisajes'), plain: tr('Liso', 'Plain', 'Liso'),
        url: tr('Minha foto', 'My picture', 'Mi foto')};
      rows.push({label: tr('Fundo', 'Background', 'Fondo'), value: walls[Prefs.wallpaper()],
        step: function (d) { cycle('wallpaper', ['cards', 'places', 'plain', 'url'], Prefs.wallpaper(), d); if (Prefs.wallpaper() === 'url' && !Prefs.opt('wallUrl', '')) askWall(); refreshBackdrop(); }});
      if (Prefs.wallpaper() === 'url') rows.push({label: tr('   endereço da foto', '   picture address', '   dirección de la foto'), value: '›', step: function (d) { if (d >= 0) askWall(); }});
      if (Prefs.wallpaper() === 'places' || /^(both|places)$/.test(Data.saver())) rows.push({label: tr('Paisagens de', 'Landscapes of', 'Paisajes de'), value: regionName(Prefs.opt('placesRegion', 'all')),
        step: function (d) { cycle('placesRegion', ['all', 'andalucia', 'spain', 'lithuania'], Prefs.opt('placesRegion', 'all'), d); refreshBackdrop(); }});
      var gl = Prefs.opt('glassLevel', 'normal');
      rows.push({label: tr('Intensidade do vidro', 'Glass strength', 'Intensidad del cristal'), value: gl === 'clear' ? tr('Mais transparente', 'More see-through', 'Más transparente') : gl === 'solid' ? tr('Mais opaco', 'More solid', 'Más opaco') : tr('Normal', 'Normal', 'Normal'),
        step: function (d) { cycle('glassLevel', ['clear', 'normal', 'solid'], gl, d); applyLook(); }});
      var ts = Prefs.opt('textSize', 'normal');
      rows.push({label: tr('Tamanho do texto', 'Text size', 'Tamaño del texto'), value: ts === 'large' ? tr('Grande', 'Large', 'Grande') : tr('Normal', 'Normal', 'Normal'),
        step: function (d) { cycle('textSize', ['normal', 'large'], ts, d); applyLook(); }});
      var co = Prefs.opt('corners', 'round');
      rows.push({label: tr('Cantos', 'Corners', 'Esquinas'), value: co === 'square' ? tr('Retos', 'Square', 'Rectas') : co === 'rounder' ? tr('Mais redondos', 'Rounder', 'Más redondeadas') : tr('Redondos', 'Round', 'Redondeadas'),
        step: function (d) { cycle('corners', ['round', 'rounder', 'square'], co, d); applyLook(); }});
      var nm = Prefs.opt('iconNames', 'none');
      rows.push({label: tr('Nomes das apps', 'App names', 'Nombres de las apps'), value: nm === 'all' ? tr('Todos', 'All', 'Todos') : nm === 'focus' ? tr('Só a escolhida', 'Only the focused one', 'Solo la elegida') : tr('Nenhum', 'None', 'Ninguno'),
        step: function (d) { cycle('iconNames', ['none', 'focus', 'all'], nm, d); renderShelf(); updateFocus(); }});
      var cs = Prefs.opt('cardSize', 'normal');
      rows.push({label: tr('Cartões', 'Cards', 'Tarjetas'), value: cs === 'small' ? tr('Menores (mais por fila)', 'Smaller (more per row)', 'Más pequeñas (más por fila)') : tr('Normais', 'Normal', 'Normales'),
        step: function (d) { cycle('cardSize', ['normal', 'small'], cs, d); applyLook(); }});
      rows.push({label: tr('Título', 'Title', 'Título'), value: Prefs.opt('titleMode', 'tab') === 'greet' ? tr('Saudação', 'Greeting', 'Saludo') : tr('Para você', 'For You', 'Para ti'),
        step: function (d) { cycle('titleMode', ['tab', 'greet'], Prefs.opt('titleMode', 'tab'), d); renderTitle(); }});
      rows.push({label: tr('Seu nome', 'Your name', 'Tu nombre'), value: Prefs.opt('name', '') || '›', step: function (d) { if (d >= 0) askName(); }});
      rows.push({label: tr('Tamanho dos ícones', 'Icon size', 'Tamaño de los iconos'), value: Prefs.opt('iconSize', 'normal') === 'small' ? tr('Compacto', 'Compact', 'Compacto') : tr('Normal', 'Normal', 'Normal'),
        step: function (d) { cycle('iconSize', ['normal', 'small'], Prefs.opt('iconSize', 'normal'), d); renderShelf(); updateFocus(); }});
      rows.push({label: tr('Animações', 'Animations', 'Animaciones'), value: Prefs.opt('motion', 'normal') === 'less' ? tr('Reduzidas', 'Reduced', 'Reducidas') : tr('Normais', 'Normal', 'Normales'),
        step: function (d) { cycle('motion', ['normal', 'less'], Prefs.opt('motion', 'normal'), d); applyLook(); }});
      rows.push({label: tr('Modo calmo', 'Calm mode', 'Modo calma'), toggle: Prefs.calm(), step: function () { Prefs.set('calm', !Prefs.calm()); applyLook(); }});
    } else if (settingsCat === 'widgets') {
      rows.push({label: tr('Relógio em cima', 'Clock at the top', 'Reloj arriba'), toggle: Prefs.opt('topClock', true) !== false,
        step: function () { Prefs.set('topClock', Prefs.opt('topClock', true) === false); applyLook(); }});
      var c24 = Prefs.opt('clock24', 'auto');
      rows.push({label: tr('Formato da hora', 'Time format', 'Formato de hora'), value: c24 === '24' ? '24 h' : c24 === '12' ? '12 h' : auto,
        step: function (d) { cycle('clock24', ['auto', '24', '12'], c24, d); renderClock(); }});
      rows.push({label: tr('Data ao lado do relógio', 'Date beside the clock', 'Fecha junto al reloj'), toggle: Prefs.opt('topDate', false) === true,
        step: function () { Prefs.set('topDate', Prefs.opt('topDate', false) !== true); renderClock(); }});
      rows.push({label: tr('Meus widgets', 'My widgets', 'Mis widgets'), value: '›', step: function (d) { if (d >= 0) openInfo('widgets'); }});
      WIDGETS.forEach(function (w) {
        rows.push({label: '   ' + widgetName(w), toggle: widgetOn(w), step: function () {
          var off = (Prefs.opt('widgetsOff', []) || []).filter(function (x) { return x !== w; });
          if (widgetOn(w)) off.push(w);
          Prefs.set('widgetsOff', off);
        }});
      });
      rows.push({label: tr('Mercados e alertas', 'Markets and alerts', 'Mercados y alertas'), value: '›', step: function (d) { if (d >= 0) openInfo('markets'); }});
      rows.push({label: tr('Previsão completa', 'Full forecast', 'Previsión completa'), value: '›', step: function (d) { if (d >= 0) openInfo('weather'); }});
      rows.push({label: tr('Widget do clima', 'Weather widget', 'Widget del clima'), toggle: Prefs.weather(),
        step: function () { Prefs.set('weather', !Prefs.weather()); renderPanels(); }});
      rows.push({label: tr('Temperatura', 'Temperature', 'Temperatura'), value: unit === 'C' ? '°C' : unit === 'F' ? '°F' : auto,
        step: function (d) { cycle('temperature', ['auto', 'C', 'F'], unit, d); renderPanels(); }});
      rows.push({label: tr('Widget de cotações', 'Quotes widget', 'Widget de cotizaciones'), toggle: Prefs.quotes(),
        step: function () { Prefs.set('quotes', !Prefs.quotes()); Data.settingsChanged(); }});
      var cnames = ['Bitcoin', 'Ethereum', 'Solana', tr('Dólar', 'Dollar', 'Dólar')];
      var count = Data.currency === 'BRL' ? 4 : 3;
      var shown = [];
      for (var c = 0; c < count; c++) shown.push(c);
      shown.push(4, 5, 6);   // XRP, then the iShares S&P 500 and NASDAQ 100 (dollars)
      for (var sh = 0; sh < shown.length; sh++) {
        (function (i) {
          rows.push({label: i < 4 ? cnames[i] : Data.coinName(i), toggle: Prefs.quotes() && Prefs.coin(i), dim: !Prefs.quotes(),
            step: function () { if (Prefs.quotes()) { Prefs.setCoin(i, !Prefs.coin(i)); Data.settingsChanged(); } }});
        })(shown[sh]);
      }
    } else if (settingsCat === 'apps') {
      rows.push({label: commTitle(), value: '›', step: function (d) { if (d >= 0) openCommunity(); }});   // Samsung: TizenBrew's modules
      if (TV.name === 'webos') {
        rows.push({label: tr('Atualizar apps sozinha', 'Update apps by itself', 'Actualizar apps solas'), toggle: Prefs.autoUpdate(), step: function () {
          var on2 = !Prefs.autoUpdate();
          Prefs.set('autoUpdate', on2);
          if (on2) {
            Prefs.set('updCheckedAt', 0);
            svcCheck();
            setTimeout(function () {
              if (store.svc === 'ok') { toast(tr('Uma vez por dia, a TV atualiza as apps que você já instalou.', 'Once a day the TV updates the apps you already installed.', 'Una vez al día la tele actualiza las apps que ya instalaste.')); autoUpdate(); }
              else toast(tr('Precisa da permissão da loja: bash install.sh no computador.', 'It needs the store permission: bash install.sh on the computer.', 'Necesita el permiso de la tienda: bash install.sh en el ordenador.'));
            }, 4000);
          }
        }});
        rows.push({label: tr('Apps ocultas', 'Hidden apps', 'Apps ocultas'), value: String(Prefs.hiddenApps().length), step: function (d) { if (d >= 0) openHiddenApps(); }});
        rows.push({label: tr('Repositórios extra', 'Extra repositories', 'Repositorios extra'), value: String((Prefs.opt('repos', []) || []).length), step: function (d) { if (d >= 0) openInfo('repos'); }});
      }
      rows.push({label: tr('Entradas HDMI', 'HDMI inputs', 'Entradas HDMI'), value: '›', step: function (d) { if (d >= 0) openInfo('inputs'); }});
      rows.push({label: tr('Apps recentes na gaveta', 'Recent apps in the drawer', 'Apps recientes en el cajón'), toggle: Prefs.opt('drawerRecent', true) !== false,
        step: function () { Prefs.set('drawerRecent', Prefs.opt('drawerRecent', true) === false); renderDrawer(); }});
    } else if (settingsCat === 'remote') {
      rows.push({label: tr('Números 1-9 abrem a prateleira', 'Numbers 1-9 open the shelf', 'Números 1-9 abren el estante'), toggle: Prefs.opt('numKeys', true) !== false,
        step: function () { Prefs.set('numKeys', Prefs.opt('numKeys', true) === false); }});
      [[403, tr('Botão vermelho', 'Red button', 'Botón rojo')], [404, tr('Botão verde', 'Green button', 'Botón verde')], [405, tr('Botão amarelo', 'Yellow button', 'Botón amarillo')],
       [406, tr('Botão azul', 'Blue button', 'Botón azul')]].forEach(function (b) {
        var c = KEY_COLORS[b[0]], now = Prefs.opt(c[0], c[1]);
        rows.push({label: b[1], value: keyActionName(now), step: function (d) { cycle(c[0], KEY_ACTIONS, now, d); }});
      });
    } else if (settingsCat === 'quick') {
      quickAll().forEach(function (t) {
        rows.push({label: t.name, toggle: quickShown(t.id), step: function () { quickShow(t.id, !quickShown(t.id)); }});
      });
    } else if (settingsCat === 'privacy') {
      if (TV.name === 'webos') rows.push({label: tr('Privacidade da LG', 'LG privacy', 'Privacidad de LG'), value: privacyText(), step: function (d) { if (d >= 0) openPrivacy(); }});
      else rows.push({label: tr('Privacidade da TV', 'TV privacy', 'Privacidad de la tele'), value: '›', step: function (d) { if (d >= 0) openTvPrivacy(); }});
      rows.push({label: tr('Modo crianças', 'Kids mode', 'Modo niños'), value: Prefs.kids() ? tr('Ligado', 'On', 'Activado') : tr('Desligado', 'Off', 'Desactivado'), step: function (d) { if (d >= 0) { closeSheets(); if (Prefs.kids()) kidsExit(); else kidsStart(); } }});
      var kl = +Prefs.opt('kidsLimit', 0);
      rows.push({label: tr('Tempo máximo no modo crianças', 'Time limit in kids mode', 'Tiempo máximo en modo niños'), value: kl ? kl + ' min' : tr('Sem limite', 'No limit', 'Sin límite'),
        step: function (d) { cycle('kidsLimit', [0, 30, 60, 90, 120], kl, d); }});
    } else if (settingsCat === 'care') {
      if (TV.name === 'webos') {
        rows.push({label: tr('Modo Desenvolvedor: tempo restante', 'Developer Mode: time left', 'Modo Desarrollador: tiempo restante'), value: devText(), step: function (d) { if (d >= 0) openDevMode(); }});
        rows.push({label: tr('Renovar o Modo Desenvolvedor sozinha', 'Renew Developer Mode by itself', 'Renovar el Modo Desarrollador sola'), toggle: Prefs.devAuto(), step: function () { Prefs.set('devAuto', !Prefs.devAuto()); }});
      }
      rows.push({label: tr('Tempo de uso', 'Time of use', 'Tiempo de uso'), value: '›', step: function (d) { if (d >= 0) openInfo('usage'); }});
      if (TV.name === 'webos') {
        rows.push({label: tr('Guardar uma cópia dos ajustes', 'Save a copy of the settings', 'Guardar una copia de los ajustes'), value: '›', step: function (d) { if (d >= 0) { saveSettings(); toast(tr('Cópia guardada na TV', 'Copy saved on the TV', 'Copia guardada en la tele')); } }});
        rows.push({label: tr('Restaurar a cópia guardada', 'Restore the saved copy', 'Restaurar la copia guardada'), value: '›', step: function (d) { if (d >= 0) showDialog(tr('Restaurar?', 'Restore?', '¿Restaurar?'), [{text: tr('Os ajustes de agora são trocados pelos da cópia.', 'The settings now are replaced by the copy\'s.', 'Los ajustes de ahora se cambian por los de la copia.')}], [{label: cancelText()}, {label: tr('Sim, restaurar', 'Yes, restore', 'Sí, restaurar'), run: restoreBackup}], 0); }});
        rows.push({label: tr('Cópia no computador / outra TV', 'Copy on the computer / another TV', 'Copia en el ordenador / otra tele'), value: '›', step: function (d) {
          if (d >= 0) showDialog(tr('Cópia no computador', 'Copy on the computer', 'Copia en el ordenador'), [
            {text: tr('No computador, na pasta do FreeTV:', 'On the computer, in the FreeTV folder:', 'En el ordenador, en la carpeta de FreeTV:')},
            {cls: 'code', text: 'node tools/settings_backup.js <IP> export > mis-ajustes.json'},
            {text: tr('E para levar a outra TV (ou voltar):', 'And to take it to another TV (or back):', 'Y para llevarla a otra tele (o volver):')},
            {cls: 'code', text: 'node tools/settings_backup.js <IP> import mis-ajustes.json'}], [{label: 'OK'}], 0);
        }});
      }
      if (window.HomeExtras) rows = rows.concat(window.HomeExtras.rows());   // Developer Mode renewal, Home button
      rows.push({label: tr('Ajustes da TV', 'TV Settings', 'Ajustes del TV'), value: '›', step: function (d) { if (d >= 0) tvSettings(); }});
    }
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
    title.appendChild(document.createTextNode(settingsTitle()));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    rowsNow = settingRows();
    list.style.height = Math.min(rowsNow.length, 7) * 78 + 'px';
    for (var i = 0; i < rowsNow.length; i++) {
      var r = rowsNow[i], row = el('div', 'row' + (r.dim ? ' dim' : '') + (r.icon ? ' hasico' : ''), holder, r.label);
      if (r.icon) sym(r.icon, row).className += ' ico';
      if (r.toggle !== undefined) setClass(el('div', 'toggle', row), 'on', r.toggle);
      else {
        var v = el('span', 'value', row);
        if (r.value === '›') v.textContent = '›';
        else { el('span', 'chev', v, '‹'); v.appendChild(document.createTextNode(r.value)); el('span', 'chev', v, '›'); }
      }
      hover(row, Z.SETTINGS, i);
    }
    el('div', 'hint', box, settingsCat ? tr('OK ou as setas mudam o valor · Voltar sobe', 'OK or the arrows change the value · Back goes up', 'OK o las flechas cambian el valor · Atrás sube') : tr('OK abre uma seção', 'OK opens a section', 'OK abre una sección') + ((window.CONFIG && CONFIG.version) ? '  ·  FreeTV v' + CONFIG.version : ''));
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
  // Other people's repositories, read only for these app ids (keep in step with store-service/store.js); they always need the "unofficial" confirmation.
  var EXTRA = [{url: 'https://atlet99.github.io/rezkatv-public/repository.json', ids: ['com.rezkatv.app', 'com.rezkatv.app.legacy']}];
  var commList = [], commOpen = -1, commState = 'idle', commAct = 0, commActs = [];
  // svc: the store service on this TV ('none' = not set up, 'checking', 'ok', 'off'); conn: the computer ('none' = unknown address, 'checking', 'ok', 'off'); flow: this install ('idle', 'asking', 'working', 'done', 'failed')
  var store = {conn: 'none', svc: 'none', via: '', flow: 'idle', id: '', phase: '', message: '', note: '', misses: 0,
    updList: [], updates: {}, installed: {}, instKnown: false, sizes: {}, freeMb: 0, flowAll: 'idle', batch: null, cur: ''}, storeTimer = 0;

  function commTitle() { return tr('Apps da comunidade', 'Community apps', 'Apps de la comunidad'); }

  /** Apps that need a word of warning before installing (kept in step with tools/community.py). */
  var COMM_CAUTION = {
    'youtube.leanback.v4': ['Substitui o YouTube oficial: apague-o você na TV antes (o computador não consegue).', 'Replaces the official YouTube: delete it yourself on the TV first (the computer cannot).', 'Reemplaza el YouTube oficial: bórralo tú en la tele antes (desde el ordenador no se puede).'],
    'com.open.hidden.menu': ['Abre o menu de serviço da LG: pode danificar a TV.', "Opens LG's service menu: it can break the TV.", 'Abre el menú de servicio de LG: puede estropear la tele.'],
    'com.pirate.refresh': ['Renova o Modo Desenvolvedor por conta própria: o FreeTV já tem o seu painel.', 'Renews Developer Mode on its own: FreeTV already has its panel.', 'Renueva el Modo Desarrollador por su cuenta: FreeTV ya trae su panel.'],
    'org.webosbrew.hbchannel': ['Só serve por inteiro numa TV com root.', 'Only fully useful on a rooted TV.', 'Solo sirve entera en una tele con root.'],
    'com.rezkatv.app': ['App de TERCEIROS, não oficial, para o HDRezka (site de filmes sem licença). O FreeTV só confere o hash: o uso é por sua conta.', 'THIRD-PARTY, unofficial app for HDRezka (an unlicensed movie site). FreeTV only checks the hash: using it is on you.', 'App de TERCEROS, no oficial, para HDRezka (un sitio de películas sin licencia). FreeTV solo comprueba el hash: usarla es cosa tuya.'],
    'com.rezkatv.app.legacy': ['App de TERCEIROS (RezkaTV, webOS 3 e 4), não oficial: mesmo aviso.', 'THIRD-PARTY app (RezkaTV, webOS 3 and 4), unofficial: same warning.', 'App de TERCEROS (RezkaTV, webOS 3 y 4), no oficial: mismo aviso.']
  };
  /** The flag tools/community.py wants for them (CAUTION there): the person gives it by confirming on this screen. */
  var COMM_FLAG = {'youtube.leanback.v4': 'official-removed', 'com.open.hidden.menu': 'sensitive', 'com.pirate.refresh': 'sensitive', 'org.webosbrew.hbchannel': 'sensitive', 'com.rezkatv.app': 'unofficial', 'com.rezkatv.app.legacy': 'unofficial'};

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

  /** One call to the store service on this TV (store-service/, packed with this app): it installs through the TV's own Developer Mode. */
  function svcCall(method, payload, done) {
    var bridge = null, over = false, timer = setTimeout(function () { finish(null); }, method === 'status' || method === 'channels' ? 70000 : method === 'remove' ? 130000 : 20000);
    function finish(r) {
      if (over) return;
      over = true;
      clearTimeout(timer);
      if (bridge) { try { bridge.cancel(); } catch (e) {} }
      done(r);
    }
    try {
      bridge = new window.PalmServiceBridge();
      bridge.onservicecallback = function (raw) { var r = null; try { r = JSON.parse(raw); } catch (e) {} finish(r); };
      bridge.call('luna://com.gathin.tvhome.store/' + method, JSON.stringify(payload || {}));
    } catch (e) { finish(null); }
  }

  /** Can this TV install by itself? 'ok' when the service has its key and its SSH session opens. */
  function svcCheck() {
    if (!window.PalmServiceBridge) { store.svc = 'none'; return; }
    store.svc = 'checking';
    svcCall('status', {}, function (r) {
      store.svc = r && r.returnValue && r.provisioned ? (r.ready ? 'ok' : 'off') : 'none';
      if (store.svc === 'ok') { svcApps(); svcUpdates(); }
      if (communityShown()) renderCommunity();
    });
  }

  /** The apps installed through Developer Mode, as the store service sees them. They are kept so that FreeTV lists an app the moment
      it is installed (the TV does not let an app read its own full list), without the computer reading the TV again. */
  function svcApps(done) {
    svcCall('apps', {}, function (r) {
      var ok = !!(r && r.returnValue && r.apps);
      if (ok) { try { localStorage.setItem('fmtv.devApps', JSON.stringify(r.apps)); } catch (e) {} if (commList.length) applyUpdateRow(); }
      if (done) done(ok);
    });
  }

  /** {id: version} of the apps Developer Mode installed: from the store service when it is there, else from the list FreeTV remembers. */
  function instMap() {
    if (store.instKnown) return store.installed;
    var m = {};
    try { (JSON.parse(localStorage.getItem('fmtv.devApps')) || []).forEach(function (a) { if (a && a.id) m[a.id] = a.version || ''; }); } catch (e) {}
    return m;
  }

  /** 1.2.10 > 1.2.9; a release is newer than its beta (the same rule as the store service). */
  function versionParts(v) {
    var m = /^v?(\d+(?:\.\d+)*)(.*)$/i.exec(String(v || '').replace(/^\s+|\s+$/g, ''));
    return m ? {n: m[1].split('.').map(Number), pre: /[A-Za-z]/.test(m[2])} : null;
  }
  function isNewerVersion(a, b) {
    var x = versionParts(a), y = versionParts(b), i;
    if (!x || !y) return false;
    for (i = 0; i < Math.max(x.n.length, y.n.length); i++) {
      if ((x.n[i] || 0) !== (y.n[i] || 0)) return (x.n[i] || 0) > (y.n[i] || 0);
    }
    return y.pre && !x.pre;
  }

  var commInst = {};

  /** Which installed apps have a newer version in the catalogue (asked of the store service); the Store marks them. */
  function svcUpdates(done) {
    svcCall('updates', {}, function (r) {
      if (r && r.returnValue && r.updates) {
        store.updList = r.updates;
        store.installed = r.installed || {};
        store.instKnown = true;
        store.sizes = r.sizes || {};
        store.freeMb = r.freeMb || 0;
        store.updates = {};
        r.updates.forEach(function (u) { store.updates[u.id] = u; });
        applyUpdateRow();
        if (communityShown()) renderCommunity();
      }
      if (done) done(!!(r && r.returnValue));
    });
  }

  /** "Update all (N)" is the first app row of the Store's list while there is something to update (the ones that need a confirmation, one by one). */
  function applyUpdateRow() {
    var open = commOpen >= 0 ? commList[commOpen] : null, row = commList[st.comm];
    if (open && open.special && store.flowAll !== 'idle') return;   // its own page is on screen (progress, result): the row goes when it is closed
    // the same app stays selected / open when a row comes or goes above it
    commInst = instMap();
    commRebuild();
    if (row) st.comm = Math.max(0, commList.indexOf(row));
    if (open) commOpen = commList.indexOf(open);
  }

  // 2.1: search, filters, order, what is new since the last visit, a wish list, extra repositories.
  var commAll = [], commQuery = '', commNotes = {}, commSpecial = {id: '*updates', special: true, manifest: {}, title: ''};
  var commCtls = [{id: '*search', ctl: 1, manifest: {}, title: ''}, {id: '*filter', ctl: 2, manifest: {}, title: ''}, {id: '*sort', ctl: 3, manifest: {}, title: ''}];
  var FEATURED = ['youtube.leanback.v4', 'twitch.adamffdev.v1', 'org.jellyfin.webos', 'org.xbmc.kodi', 'com.limelight.webos', 'com.beb.plxnative', 'com.retroarch.webos', 'com.immich.webos'];
  var COMM_FILTERS = ['all', 'featured', 'new', 'games', 'media', 'tools', 'noroot', 'installed', 'wish'], COMM_SORTS = ['rec', 'new', 'az'];
  var GAME_RE = /game|pinball|doom|ninja|2048|openttd|retro|emulat|steam link|moonlight|gamestream|punktfunk/i;
  var MEDIA_RE = /jellyfin|plex|kodi|youtube|twitch|crunchy|music|player|iptv|video|stream|photo|immich|bili|subsonic|fin\b|movie|cinema|media|radio|spotify/i;

  function commCat(p) { var t = p.title + ' ' + commDesc(p) + ' ' + p.id; return GAME_RE.test(t) ? 'games' : MEDIA_RE.test(t) ? 'media' : 'tools'; }
  function commSeen() { var s = Prefs.opt('commSeen', null); return s instanceof Array ? s : null; }
  function commIsNew(p) { var s = commSeen(); return !!s && !p.special && !p.ctl && s.indexOf(p.id) < 0; }
  function wish() { var w = Prefs.opt('wish', []); return w instanceof Array ? w : []; }
  function commMarkSeen() { if (commAll.length) Prefs.set('commSeen', commAll.map(function (p) { return p.id; })); }

  function filterName(f) {
    return {all: tr('Todas', 'All', 'Todas'), featured: tr('Destaques', 'Featured', 'Destacadas'), 'new': tr('Novas', 'New', 'Nuevas'), games: tr('Jogos', 'Games', 'Juegos'),
      media: tr('Multimídia', 'Media', 'Multimedia'), tools: tr('Utilidades', 'Tools', 'Utilidades'), noroot: tr('Sem root', 'No root', 'Sin root'),
      installed: tr('Instaladas', 'Installed', 'Instaladas'), wish: tr('Minha lista', 'My list', 'Mi lista')}[f];
  }
  function sortName(o) { return {rec: tr('Recomendado', 'Recommended', 'Recomendado'), 'new': tr('Novas primeiro', 'New first', 'Nuevas primero'), az: 'A-Z'}[o]; }

  function commRebuild() {
    var f = Prefs.opt('commFilter', 'all'), so = Prefs.opt('commSort', 'rec'), q = commQuery.toLowerCase(), w = wish();
    var list = commAll.filter(function (p) {
      if (q && (p.title + ' ' + commDesc(p) + ' ' + p.id).toLowerCase().indexOf(q) < 0) return false;
      if (f === 'games' || f === 'media' || f === 'tools') return commCat(p) === f;
      if (f === 'noroot') return !p.manifest.rootRequired;
      if (f === 'installed') return commInst[p.id] !== undefined;
      if (f === 'wish') return w.indexOf(p.id) >= 0;
      if (f === 'featured') return FEATURED.indexOf(p.id) >= 0;
      if (f === 'new') return commIsNew(p);
      return true;
    });
    function az(a, b) { return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1; }
    list.sort(so === 'az' ? az : so === 'new' ? function (a, b) { return (commIsNew(a) ? 0 : 1) - (commIsNew(b) ? 0 : 1) || commOrder(a, b); } : commOrder);
    var n = store.updList.filter(function (u) { return !u.flag; }).length;
    commSpecial.title = tr('Atualizar tudo (' + n + ')', 'Update all (' + n + ')', 'Actualizar todo (' + n + ')');
    commList = commCtls.concat(n > 0 ? [commSpecial] : [], list);
  }

  /** A search, filter or order row: OK or the arrows change it. */
  function commCtl(p, d) {
    if (p.ctl === 1) {
      askText(tr('Procurar na Loja', 'Search the Store', 'Buscar en la Tienda'), tr('Nome ou assunto (jellyfin, jogos, vpn…). Vazio mostra tudo.', 'A name or a subject (jellyfin, games, vpn…). Empty shows all.',
        'Un nombre o un tema (jellyfin, juegos, vpn…). Vacío lo muestra todo.'), commQuery, function (v) { commQuery = trim(v); commRebuild(); st.comm = 0; renderCommunity(); });
      return;
    }
    if (p.ctl === 2) cycle('commFilter', COMM_FILTERS, Prefs.opt('commFilter', 'all'), d);
    else cycle('commSort', COMM_SORTS, Prefs.opt('commSort', 'rec'), d);
    commRebuild();
    renderCommunity();
  }

  /** The catalogue and the extra sources, once; done() when the main one is in (or failed: commState). */
  function commLoad(done) {
    if (commAll.length) { if (done) done(); return; }
    Data.getJson(CATALOGUE, function (err, data) {
      if (err || !data || !data.packages) { commState = 'error'; if (done) done(); return; }
      commInst = instMap();
      commAll = data.packages.filter(function (p) { return p && p.id && p.manifest; });
      if (!commSeen()) commMarkSeen();   // the first visit: nothing is "new" yet
      commRebuild();
      commState = 'ready';
      if (done) done();
      var extra = EXTRA.concat((Prefs.opt('repos', []) || []).map(function (u) { return {url: u, all: true}; }));
      extra.forEach(function (src) {
        Data.getJson(src.url, function (e2, d2) {
          if (e2 || !d2 || !d2.packages) return;   // an extra source that does not answer is just not offered
          d2.packages.forEach(function (p) {
            if (p && p.manifest && (src.all || src.ids.indexOf(p.id) >= 0) && !commAll.some(function (o) { return o.id === p.id; })) {
              if (src.all) p.repo = src.url.replace(/^https:\/\//, '').split('/')[0];
              commAll.push(p);
            }
          });
          if (commOpen < 0) { commInst = instMap(); commRebuild(); if (st.zone === Z.COMM) renderCommunity(); }
        });
      });
    });
  }

  INFO.repos = function () {
    var list = Prefs.opt('repos', []) || [], rows = list.map(function (u) {
      return {label: u.replace(/^https:\/\//, ''), value: '›', run: function () {
        showDialog(tr('Tirar este repositório?', 'Remove this repository?', '¿Quitar este repositorio?'), [{text: u}], [{label: cancelText()}, {label: tr('Sim, tirar', 'Yes, remove', 'Sí, quitar'), run: function () {
          Prefs.set('repos', (Prefs.opt('repos', []) || []).filter(function (x) { return x !== u; }));
          commAll = [];
          openInfo('repos');
        }}], 0);
      }};
    });
    rows.push({label: tr('Adicionar um repositório…', 'Add a repository…', 'Añadir un repositorio…'), value: '›', icon: 'apps', run: function () {
      askText(tr('Repositório', 'Repository', 'Repositorio'), tr('O endereço https do seu apps.json (formato do webOS Homebrew).', 'The https address of its apps.json (webOS Homebrew format).',
        'La dirección https de su apps.json (formato de webOS Homebrew).'), '', function (v) {
          v = trim(v);
          if (!/^https:\/\/\S+$/.test(v)) { toast(tr('Precisa começar com https://', 'It must start with https://', 'Tiene que empezar por https://')); return; }
          Data.getJson(v, function (err, d) {
            if (err || !d || !d.packages) { toast(tr('Não parece um repositório', 'That does not look like a repository', 'No parece un repositorio')); return; }
            Prefs.set('repos', (Prefs.opt('repos', []) || []).concat([v]).slice(-8));
            commAll = [];
            toast(d.packages.length + ' apps');
            openInfo('repos');
          });
        }, 'https://');
    }});
    return {title: tr('Repositórios extra', 'Extra repositories', 'Repositorios extra'), icon: 'apps', rows: rows,
      hint: tr('Só repositórios em que você confia: as apps passam pelas mesmas verificações (sem root, https, SHA-256)', 'Only repositories you trust: their apps go through the same checks (no root, https, SHA-256)',
        'Solo repositorios de confianza: sus apps pasan las mismas comprobaciones (sin root, https, SHA-256)')};
  };

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
    var upd = store.svc === 'ok' && !!store.updates[app.id], flag = COMM_FLAG[app.id] || '';
    if (upd && flag === 'official-removed') flag = '';
    store.id = app.id;
    store.flow = 'working';
    store.phase = 'starting';
    store.message = store.note = '';
    store.misses = 0;
    store.via = store.svc === 'ok' ? 'tv' : 'pc';
    renderCommunity();
    if (store.via === 'tv') {
      svcCall('install', {id: app.id, flag: flag, update: upd}, function (r) {
        if (!r || !r.returnValue) {
          store.flow = 'failed';
          store.message = r && r.error ? r.error : tr('A TV não respondeu.', 'The TV did not answer.', 'La tele no respondió.');
          if (communityShown()) renderCommunity();
          return;
        }
        svcPoll(app);
      });
      return;
    }
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
        toast(app.title + ': ' + tr(store.updates[app.id] ? 'atualizada' : 'instalada', store.updates[app.id] ? 'updated' : 'installed', store.updates[app.id] ? 'actualizada' : 'instalada'));
        svcUpdates();
        setTimeout(svcUpdates, 8000);
        loadApps(function () { renderShelf(); renderDrawer(); updateFocus(); });
      } else if (r.phase === 'failed') {
        store.flow = 'failed';
        store.message = r.message || '';
        toast(app.title + ': ' + tr('não foi instalada', 'was not installed', 'no se instaló'));
      } else storeTimer = setTimeout(function () { storePoll(app); }, 1500);
      if (communityShown()) renderCommunity();
    });
  }

  function svcPoll(app) {
    clearTimeout(storeTimer);
    svcCall('job', {}, function (r) {
      var j = r && r.job;
      if (!j) {
        if (++store.misses > 10) { store.flow = 'failed'; store.message = tr('A TV parou de responder.', 'The TV stopped answering.', 'La tele dejó de responder.'); if (communityShown()) renderCommunity(); return; }
        storeTimer = setTimeout(function () { svcPoll(app); }, 2000);
        return;
      }
      store.misses = 0;
      if (j.id !== app.id) { storeTimer = setTimeout(function () { svcPoll(app); }, 1500); return; }
      store.phase = j.phase;
      store.note = j.note || '';
      if (j.phase === 'done') {
        store.flow = 'done';
        toast(app.title + ': ' + tr('instalada', 'installed', 'instalada'));
        svcApps(function () { loadApps(function () { renderShelf(); renderDrawer(); updateFocus(); }); });
      } else if (j.phase === 'failed') {
        store.flow = 'failed';
        store.message = j.message || '';
        toast(app.title + ': ' + tr('não foi instalada', 'was not installed', 'no se instaló'));
      } else storeTimer = setTimeout(function () { svcPoll(app); }, 1500);
      if (communityShown()) renderCommunity();
    });
  }

  var commFromShelf = false;

  function openCommunity(fromShelf) {
    if (TV.name === 'tizen') { setClass($('settings'), 'open', false); openModules(); return; }
    commFromShelf = fromShelf === true;
    setClass($('settings'), 'open', false);
    st.zone = Z.COMM;
    st.comm = 0;
    commOpen = -1;
    commState = commAll.length ? 'ready' : 'loading';
    if (commAll.length) { commInst = instMap(); commRebuild(); }
    renderCommunity();
    setClass($('community'), 'open', true);
    updateFocus();
    svcCheck();
    storeCheck();
    if (commAll.length) return;
    commLoad(function () { applyUpdateRow(); st.comm = commList.length > 3 ? 3 : 0; renderCommunity(); });
  }

  function commOrder(a, b) {
    if (a.ctl || b.ctl) return a.ctl ? (b.ctl ? a.ctl - b.ctl : -1) : 1;
    if (a.special || b.special) return a.special ? -1 : 1;
    var fa = FEATURED.indexOf(a.id) >= 0 ? 0 : 1, fb = FEATURED.indexOf(b.id) >= 0 ? 0 : 1;
    var ia = commInst[a.id] !== undefined ? 0 : 1, ib = commInst[b.id] !== undefined ? 0 : 1;
    if (ia !== ib) return ia - ib;
    var ra = a.manifest.rootRequired ? 1 : 0, rb = b.manifest.rootRequired ? 1 : 0;
    if (ra !== rb) return ra - rb;
    if (fa !== fb) return fa - fb;
    return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
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
    var onTv = store.via === 'tv';
    return phase === 'downloading' ? (onTv ? tr('Baixando o pacote na TV…', 'Downloading the package on the TV…', 'Descargando el paquete en la tele…')
        : tr('Baixando o pacote no computador…', 'Downloading the package on the computer…', 'Descargando el paquete en el ordenador…'))
        : phase === 'verifying' ? tr('Conferindo o hash SHA-256…', 'Checking the SHA-256 hash…', 'Comprobando el hash SHA-256…')
        : phase === 'installing' ? tr('Instalando na TV…', 'Installing on the TV…', 'Instalando en la tele…')
        : tr('Preparando…', 'Getting ready…', 'Preparando…');
  }

  /** "Update all": what would be updated, the button, then the progress (one app after the other, in the store service). */
  function renderUpdateAll(box) {
    var list = store.updList;
    line(box, '', '').appendChild(el('b', '', null, tr('Atualizar tudo', 'Update all', 'Actualizar todo')));
    if (store.flowAll === 'working') {
      var b = store.batch || {};
      line(box, '', (store.cur ? store.cur + '  ' : '') + (b.total ? '(' + (b.n || 0) + '/' + b.total + ')' : '') + '  ' + phaseText(store.phase));
      line(box, '', tr('Não desligue a TV. Voltar deixa a atualização continuar.', 'Do not turn the TV off. Back lets the update carry on.', 'No apagues la tele. Atrás deja que siga actualizando.'));
    } else if (store.flowAll === 'done' || store.flowAll === 'failed') {
      var d = store.batch || {};
      if (store.flowAll === 'failed') line(box, 'warn', tr('Não foi possível atualizar: ', 'Could not update: ', 'No se pudo actualizar: ') + store.message);
      else line(box, '', tr('Pronto: ' + (d.done || 0) + ' atualizadas', 'Done: ' + (d.done || 0) + ' updated', 'Listo: ' + (d.done || 0) + ' actualizadas') +
          (d.failed ? tr(' · ' + d.failed + ' com erro', ' · ' + d.failed + ' failed', ' · ' + d.failed + ' con error') : ''));
      action(box, tr('Ver mais apps', 'Browse more apps', 'Ver más apps'), function () { store.flowAll = 'idle'; commOpen = -1; commAct = 0; applyUpdateRow(); renderCommunity(); });
    } else {
      line(box, '', tr('Cada uma é baixada na TV, o hash SHA-256 é conferido e instalada por cima: as apps e seus ajustes são mantidos.',
          'Each one is downloaded on the TV, its SHA-256 hash checked, and installed over the old one: the apps and their settings are kept.',
          'Cada una se descarga en la tele, se comprueba su hash SHA-256 y se instala encima: las apps y sus ajustes se conservan.'));
      list.forEach(function (u) {
        line(box, u.flag ? 'warn' : '', u.title + '  v' + u.from + ' → v' + u.to + (u.flag ? tr('  (uma a uma, pede confirmação)', '  (one by one, it asks first)', '  (una a una, pide confirmación)') : ''));
      });
      if (store.flow === 'working') line(box, '', tr('Há outra instalação em andamento.', 'Another install is in progress.', 'Hay otra instalación en marcha.'));
      else action(box, tr('Atualizar tudo', 'Update all', 'Actualizar todo'), storeUpdateAll);
    }
    if (commAct >= commActs.length) commAct = 0;
    el('div', 'hint', box, tr('Voltar para a lista', 'Back to the list', 'Atrás vuelve a la lista'));
    updateFocus();
  }

  function storeUpdateAll() {
    store.flowAll = 'working';
    store.batch = null;
    store.cur = '';
    store.phase = 'starting';
    store.misses = 0;
    store.via = 'tv';
    renderCommunity();
    svcCall('updateAll', {}, function (r) {
      if (!r || !r.returnValue) {
        store.flowAll = 'failed';
        store.message = r && r.error ? r.error : tr('A TV não respondeu.', 'The TV did not answer.', 'La tele no respondió.');
        if (communityShown()) renderCommunity();
        return;
      }
      svcPollAll(function (batch) {
        store.flowAll = batch ? 'done' : 'failed';
        if (!batch) store.message = tr('A TV parou de responder.', 'The TV stopped answering.', 'La tele dejó de responder.');
        toast(tr('Atualizadas: ', 'Updated: ', 'Actualizadas: ') + (batch ? batch.done : 0));
        svcApps(function () { loadApps(function () { renderShelf(); renderDrawer(); updateFocus(); }); });
        svcUpdates();
        setTimeout(svcUpdates, 8000);   // the TV's app list takes a few seconds to show the new versions
        if (communityShown()) renderCommunity();
      });
    });
  }

  /** Follows the store service's batch until it ends: done(batch), or done(null) when the TV stops answering. */
  function svcPollAll(done) {
    clearTimeout(storeTimer);
    svcCall('job', {}, function (r) {
      var j = r && r.job, b = j && j.batch;
      if (!b) {
        if (++store.misses > 10) { done(null); return; }
        storeTimer = setTimeout(function () { svcPollAll(done); }, 2000);
        return;
      }
      store.misses = 0;
      store.batch = b;
      store.cur = j.title || '';
      store.phase = j.phase;
      if (communityShown() && store.flowAll === 'working') renderCommunity();
      if (b.finished) { done(b); return; }
      storeTimer = setTimeout(function () { svcPollAll(done); }, 1500);
    });
  }

  // MARK: - Apps hidden from All Apps, and what LG's TV does with your viewing

  function openTvPrivacy() {
    showDialog(tr('Privacidade da TV', 'TV privacy', 'Privacidad de la tele'), [
      {text: tr('A Samsung também reconhece o que você vê (ACR). Desligue nos ajustes da TV: Geral → Termos e privacidade (ou Suporte → Termos e políticas) → Serviços de informação de visualização e Publicidade baseada em interesses.',
          'Samsung also recognises what you watch (ACR). Turn it off in the TV\'s settings: General → Terms & Privacy (or Support → Terms & Policies) → Viewing Information Services and Interest-Based Advertisement.',
          'Samsung también reconoce lo que ves (ACR). Apágalo en los ajustes de la tele: General → Términos y privacidad (o Soporte → Términos y políticas) → Servicios de información de visualización y Publicidad basada en intereses.')},
      {text: tr('Os nomes mudam conforme o ano da TV. Mais em docs/PRIVACIDAD.md.', 'Names change with the TV\'s year. More in docs/PRIVACIDAD.md.', 'Los nombres cambian según el año de la tele. Más en docs/PRIVACIDAD.md.')}
    ], [{label: tr('Fechar', 'Close', 'Cerrar')}], 0);
  }

  function openHiddenApps() {
    var ids = Prefs.hiddenApps(), names = ids.map(function (id) {
      for (var i = 0; i < apps.length; i++) if (apps[i].id === id) return apps[i].title;
      return null;
    }).filter(function (n) { return n; });
    showDialog(tr('Apps ocultas', 'Hidden apps', 'Apps ocultas'), [
      {text: names.length ? names.join(' · ') : tr('Nenhuma.', 'None.', 'Ninguna.')},
      {text: tr('Continuam instaladas: só saem de «Todas as apps». Segure OK numa app para ocultá-la.', 'They stay installed: they only leave "All Apps". Hold OK on an app to hide it.', 'Siguen instaladas: solo salen de «Todas las apps». Mantén OK sobre una app para ocultarla.')}
    ], [{label: tr('Mostrar todas', 'Show them all', 'Mostrar todas'), run: function () {
      Prefs.set('hiddenApps', []);
      pickShelf();
      toast(tr('Apps ocultas: nenhuma', 'Hidden apps: none', 'Apps ocultas: ninguna'));
    }}, {label: tr('Fechar', 'Close', 'Cerrar')}], 0);
  }

  var privacy = null;   // what the TV says about LG's ACR: {acr, send, audio, solution} or {ok:false, error}

  function privacyText() {
    if (!privacy) return '›';
    if (!privacy.ok) return '?';
    return privacy.acr || privacy.send ? tr('ACR ligado ⚠', 'ACR on ⚠', 'ACR activo ⚠') : tr('ACR desligado ✓', 'ACR off ✓', 'ACR apagado ✓');
  }

  function privacyCheck(done) {
    if (TV.name !== 'webos') { if (done) done(); return; }
    svcCall('privacy', {}, function (r) {
      privacy = r && r.returnValue && r.privacy ? r.privacy : {ok: false, error: r && r.error === 'sin permiso'
          ? tr('Falta o acesso da loja: bash install.sh no computador.', 'The store permission is missing: bash install.sh on the computer.', 'Falta el permiso de la tienda: bash install.sh en el ordenador.')
          : tr('A TV não respondeu.', 'The TV did not answer.', 'La tele no respondió.')};
      if (done) done();
    });
  }

  function openPrivacy() {
    var title = tr('Privacidade da LG', 'LG privacy', 'Privacidad de LG');
    var token = showDialog(title, [{text: tr('Olhando a TV…', 'Looking at the TV…', 'Mirando la tele…')}], [], 0);
    privacyCheck(function () {
      if (dlg.token !== token || st.zone !== Z.DLG) return;
      var lines = [];
      if (!privacy.ok) lines.push({cls: 'warn', text: privacy.error});
      else if (privacy.acr || privacy.send) {
        lines.push({cls: 'warn', text: tr('O ACR da LG está LIGADO' + (privacy.audio ? ' e escuta o som do que você vê' : '') + (privacy.solution ? ' (' + privacy.solution + ')' : '') + '. O FreeTV não consegue desligá-lo.',
            'LG\'s ACR is ON' + (privacy.audio ? ' and listens to the sound of what you watch' : '') + (privacy.solution ? ' (' + privacy.solution + ')' : '') + '. FreeTV cannot turn it off.',
            'El ACR de LG está ACTIVO' + (privacy.audio ? ' y escucha el sonido de lo que ves' : '') + (privacy.solution ? ' (' + privacy.solution + ')' : '') + '. FreeTV no puede apagarlo.')});
        lines.push({text: tr('Desligue você, nos ajustes da LG: Geral → Sistema → Configurações adicionais → Live Plus (desligado); Configurações da tela inicial → Promoção (desligado); Publicidade → Limitar rastreamento (ligado); Contratos do usuário → desmarque as opções.',
            'Turn it off in LG\'s own settings: General → System → Additional Settings → Live Plus (off); Home Settings → Home Promotion (off); Advertisement → Limit Ad Tracking (on); User Agreements → untick the optional ones.',
            'Apágalo en los ajustes de LG: General → Sistema → Ajustes adicionales → Live Plus (apagado); Ajustes de inicio → Promoción (apagado); Publicidad → Limitar seguimiento (activado); Acuerdos de usuario → desmarca los opcionales.')});
      } else lines.push({text: tr('O ACR da LG está desligado. Confira também a publicidade e as promoções (docs/PRIVACIDAD.md).', 'LG\'s ACR is off. Also check the advertising and promotion settings (docs/PRIVACIDAD.md).', 'El ACR de LG está apagado. Revisa también la publicidad y las promociones (docs/PRIVACIDAD.md).')});
      showDialog(title, lines, [{label: tr('Fechar', 'Close', 'Cerrar')}], 0);
      if (st.zone === Z.SETTINGS) renderSettings();
    });
  }


  // MARK: - Tile sheets: the quick panel and the TV's health, big glass tiles you move over with the arrows

  var tileSheet = {kind: '', defs: []}, HIDDEN_RE = /^(com\.webos\.app\.(home|homeconnect|discovery|launcher)|com\.local\.nativehome|io\.freemytv|com\.gathin\.tvhome[\w.]*)$/;

  function tileDefs() { return tileSheet.kind === 'health' ? healthTiles() : quickTiles(); }

  function openTiles(kind) {
    if (Prefs.kids()) { kidsExit(); return; }
    tileSheet.kind = kind;
    tileSheet.defs = tileDefs();
    st.tile = 0;
    st.zone = Z.TILES;
    renderTiles();
    setClass($('tilesheet'), 'open', true);
    updateFocus();
    if (kind === 'health') refreshHealth();
  }

  function renderTiles() {
    var box = $('tilesheet').firstChild;
    box.innerHTML = '';
    var title = el('div', 'title', box), health = tileSheet.kind === 'health';
    sym(health ? 'health' : 'sparkles', title);
    title.appendChild(document.createTextNode(health ? tr('Saúde da TV', 'TV health', 'Salud de la tele') : tr('Painel rápido', 'Quick panel', 'Panel rápido')));
    var n = tileSheet.defs.length, cols = tileCols(n), rows = Math.ceil(n / cols), tw = cols === 2 ? 440 : cols === 3 ? 372 : 340, gap = cols === 4 ? 32 : 42, th = rows > 2 ? 214 : 250;
    box.style.width = (cols * tw + (cols - 1) * gap + 60) + 'px';
    box.style.left = Math.round((1920 - (cols * tw + (cols - 1) * gap + 60)) / 2) + 'px';
    box.style.top = Math.round((1080 - (rows * th + (rows - 1) * gap + 190)) / 2) + 'px';
    var wrap = el('div', 'tiles2', box);
    wrap.style.height = (rows * th + (rows - 1) * gap) + 'px';
    tileSheet.defs.forEach(function (t, i) {
      var tile = el('div', 'qtile' + (t.on ? ' on' : '') + (rows > 2 ? ' short' : ''), wrap);
      tile.style.width = tw + 'px';
      tile.style.height = th + 'px';
      tile.style.left = (i % cols) * (tw + gap) + 'px';
      tile.style.top = Math.floor(i / cols) * (th + gap) + 'px';
      sym(t.sym, tile);
      if (t.dot) el('div', 'dot' + (t.dot === 'ok' ? '' : ' ' + t.dot), tile);
      el('div', 'name', tile, t.name);
      el('div', 'sub', tile, t.sub || '');
      hover(tile, Z.TILES, i);
    });
    el('div', 'hint', box, tileSheet.kind === 'health' ? tr('OK abre a seção · Voltar fecha', 'OK opens the section · Back closes', 'OK abre la sección · Atrás cierra') : tr('OK usa · Voltar fecha', 'OK uses it · Back closes', 'OK lo usa · Atrás cierra')).style.marginTop = '22px';
    updateFocus();
  }

  /** Columns for a tile sheet: two for up to four tiles, three for six, four for more. */
  function tileCols(n) { return n <= 4 ? 2 : n <= 6 ? 3 : 4; }

  var QUICK_OFF = ['accent', 'apps', 'store', 'tvset', 'reload', 'profile', 'usage', 'routines'];   // tiles that start hidden (Home Settings → Quick panel)
  function quickShown(id) { return (Prefs.opt('quickHidden', QUICK_OFF) || []).indexOf(id) < 0; }
  function quickShow(id, on) {
    var hidden = (Prefs.opt('quickHidden', QUICK_OFF) || []).filter(function (x) { return x !== id; });
    if (!on) hidden.push(id);
    Prefs.set('quickHidden', hidden);
  }

  /** The quick panel's tiles: the ones the person keeps, at most twelve. */
  function quickTiles() {
    var apps2 = quickApps().map(findApp).filter(function (a) { return a; }).map(function (a) {
      return {id: 'app:' + a.id, sym: 'play', name: a.title, sub: tr('Abrir', 'Open', 'Abrir'), run: function () { closeSheets(); launcher(a.id, a.title)(); }};
    });
    return quickAll().filter(function (t) { return quickShown(t.id); }).concat(apps2).slice(0, 12);
  }

  /** Every tile the quick panel can have, for this TV. */
  function quickAll() {
    return quickDefs().filter(function (t) { return TV.name === 'webos' || !t.lg; });
  }

  function quickDefs() {
    var on = tr('Ligado', 'On', 'Activado'), off = tr('Desligado', 'Off', 'Desactivado'), left = sleep.end ? Math.max(1, Math.ceil((sleep.end - Date.now()) / 60000)) : 0;
    var theme = Prefs.theme(), themes = {auto: tr('Automático', 'Automatic', 'Automático'), light: tr('Claro', 'Light', 'Claro'), dark: tr('Escuro', 'Dark', 'Oscuro')};
    function again() { tileSheet.defs = quickTiles(); renderTiles(); }
    return [
      {id: 'search', sym: 'search', name: tr('Procurar', 'Search', 'Buscar'), sub: tr('Apps, canais, YouTube', 'Apps, channels, YouTube', 'Apps, canales, YouTube'), run: function () { closeSheets(); openSearch(); }},
      {id: 'calm', sym: 'calm', name: tr('Modo calmo', 'Calm mode', 'Modo calma'), sub: Prefs.calm() ? on : off, on: Prefs.calm(), run: function () { Prefs.set('calm', !Prefs.calm()); applyLook(); again(); }},
      {id: 'timer', lg: true, sym: 'timer', name: tr('Desligar em…', 'Sleep timer', 'Apagar en…'), sub: left ? tr('Faltam ' + left + ' min', left + ' min left', 'Quedan ' + left + ' min') : off, on: !!left, run: sleepNext},
      {id: 'kids', sym: 'kids', name: tr('Modo crianças', 'Kids mode', 'Modo niños'), sub: Prefs.kids() ? tr('Ligado', 'On', 'Activado') : tr('Só os canais deles', 'Only their channels', 'Solo sus canales'), on: Prefs.kids(), run: function () { closeSheets(); kidsStart(); }},
      {id: 'health', lg: true, sym: 'health', name: tr('Saúde da TV', 'TV health', 'Salud de la tele'), sub: healthSummary(), run: function () { openTiles('health'); }},
      {id: 'weather', sym: Data.weather ? Data.symbol(Data.weather.code, Data.weather.isDay) : 'cloud', name: tr('Clima', 'Weather', 'El tiempo'),
        sub: Data.weather ? Data.degrees(Data.weather.temp) + ' · ' + Data.condition(Data.weather.code, Data.weather.isDay) : '', run: function () { openInfo('weather'); }},
      {id: 'markets', sym: 'bitcoin', name: tr('Mercados', 'Markets', 'Mercados'), sub: tr('Gráficos e alertas', 'Charts and alerts', 'Gráficas y alertas'), run: function () { openInfo('markets'); }},
      {id: 'widgets', sym: 'partly_cloudy_day', name: tr('Meus widgets', 'My widgets', 'Mis widgets'), sub: tr('Calendário, notas, futebol…', 'Calendar, notes, football…', 'Calendario, notas, fútbol…'), run: function () { openInfo('widgets'); }},
      {id: 'profile', sym: 'home', name: tr('Perfil', 'Profile', 'Perfil'), sub: profileName(profileNow()), run: function () { openInfo('profiles'); }},
      {id: 'usage', sym: 'timer', name: tr('Tempo de uso', 'Time of use', 'Tiempo de uso'), sub: tr('Hoje e esta semana', 'Today and this week', 'Hoy y esta semana'), run: function () { openInfo('usage'); }},
      {id: 'routines', sym: 'timer', name: tr('Rotinas', 'Routines', 'Rutinas'), sub: String(routines().length), run: function () { openInfo('routines'); }},
      {id: 'theme', sym: 'sunny', name: tr('Tema', 'Theme', 'Tema'), sub: themes[theme], on: theme !== 'auto',
        run: function () { cycle('theme', ['auto', 'light', 'dark'], theme, 1); checkNight(); again(); }},
      {id: 'saver', sym: 'bedtime', name: tr('Protetor de tela', 'Screensaver', 'Salvapantallas'), sub: tr('Agora', 'Now', 'Ahora'),
        run: function () { closeSheets(); setTimeout(showSaver, 300); }},
      {id: 'accent', sym: 'sparkles', name: tr('Cor de destaque', 'Accent colour', 'Color de acento'), sub: accentNames()[Prefs.accent()],
        run: function () { cycle('accent', ACCENTS, Prefs.accent(), 1); applyLook(); again(); }},
      {id: 'apps', sym: 'apps', name: tr('Todos os Apps', 'All Apps', 'Todas las apps'), sub: tr('Tudo o que está na TV', 'Everything on the TV', 'Todo lo que hay en la tele'),
        run: function () { closeSheets(); openApps(); }},
      {id: 'store', lg: true, sym: 'gamepad', name: tr('Loja', 'Store', 'Tienda'), sub: tr('Apps da comunidade', 'Community apps', 'Apps de la comunidad'),
        run: function () { closeSheets(); openCommunity(true); }},
      {id: 'tvset', sym: 'tv_settings', name: tr('Ajustes da TV', 'TV Settings', 'Ajustes del TV'), sub: tr('Imagem, som, rede…', 'Picture, sound, network…', 'Imagen, sonido, red…'),
        run: function () { closeSheets(); tvSettings(); }},
      {id: 'reload', sym: 'sync', name: tr('Recarregar o FreeTV', 'Reload FreeTV', 'Recargar FreeTV'), sub: tr('Se algo ficou estranho', 'If something looks wrong', 'Si algo se ve raro'),
        run: function () { location.reload(); }},
      {id: 'settings', sym: 'settings', name: tr('Ajustes do Início', 'Home Settings', 'Ajustes de inicio'), sub: tr('Aparência, apps, privacidade…', 'Look, apps, privacy…', 'Aspecto, apps, privacidad…'), run: function () { closeSheets(); openSettings(); }}
    ];
  }

  // --- the TV's health: Developer Mode, updates, space, LG's ACR, the store's permission, FreeTV's own version

  var latestVer = '';

  function versionCheck(done) {
    if (TV.name !== 'webos') { if (done) done(); return; }
    Data.getJson('https://raw.githubusercontent.com/PharmaJava/FreeTV/main/home/appinfo.json', function (err, d) {
      if (!err && d && d.version) latestVer = String(d.version);
      if (done) done();
    });
  }

  function newAppsText() {
    var n = commAll.filter(commIsNew).length;
    return n ? tr(' · ' + n + ' apps novas', ' · ' + n + ' new apps', ' · ' + n + ' apps nuevas') : '';
  }

  function healthSummary() {
    var bad = 0;
    healthTiles().forEach(function (t) { if (t.dot && t.dot !== 'ok') bad++; });
    return bad ? (bad === 1 ? tr('1 coisa para olhar', '1 thing to look at', '1 cosa que mirar') : tr(bad + ' coisas para olhar', bad + ' things to look at', bad + ' cosas que mirar')) : tr('Tudo em ordem', 'All good', 'Todo en orden');
  }

  function healthTiles() {
    var days = dev.hours === null ? null : dev.hours / 24, ver = (window.CONFIG && CONFIG.version) || '', newer = latestVer && ver && isNewerVersion(latestVer, ver);
    var n = store.updList.length, free = store.freeMb;
    return [
      {sym: 'sync', name: tr('Modo Desenvolvedor', 'Developer Mode', 'Modo Desarrollador'), sub: days === null ? tr('A verificar…', 'Checking…', 'Comprobando…') : devDays(dev.hours), dot: days === null ? '' : days < 7 ? 'bad' : days < 14 ? 'warn' : 'ok', run: function () { closeSheets(); openDevMode(); }},
      {sym: 'apps', name: tr('Atualizações', 'Updates', 'Actualizaciones'), sub: store.svc !== 'ok' ? tr('A verificar…', 'Checking…', 'Comprobando…') : n ? (n === 1 ? tr('1 app com versão nova', '1 app has a new version', '1 app con versión nueva') : tr(n + ' apps com versão nova', n + ' apps have a new version', n + ' apps con versión nueva')) : tr('Tudo em dia', 'Everything is up to date', 'Todo al día'), dot: store.svc !== 'ok' ? '' : n ? 'warn' : 'ok', run: function () { closeSheets(); openCommunity(true); }},
      {sym: 'tv', name: tr('Espaço livre', 'Free space', 'Espacio libre'), sub: free ? free + ' MB' : tr('A verificar…', 'Checking…', 'Comprobando…'), dot: !free ? '' : free < 60 ? 'bad' : free < 150 ? 'warn' : 'ok', run: function () { closeSheets(); openCommunity(true); }},
      {sym: 'lock', name: tr('Privacidade da LG', 'LG privacy', 'Privacidad de LG'), sub: !privacy ? tr('A verificar…', 'Checking…', 'Comprobando…') : !privacy.ok ? '?' : privacy.acr || privacy.send ? tr('O ACR está ligado', 'ACR is on', 'El ACR está activo') : tr('O ACR está desligado', 'ACR is off', 'El ACR está apagado'), dot: !privacy || !privacy.ok ? '' : privacy.acr || privacy.send ? 'warn' : 'ok', run: function () { closeSheets(); openPrivacy(); }},
      {sym: 'check', name: tr('Loja na TV', 'Store on the TV', 'Tienda en la tele'), sub: store.svc === 'ok' ? tr('Pronta', 'Ready', 'Lista') + newAppsText() : store.svc === 'checking' ? tr('A verificar…', 'Checking…', 'Comprobando…') : tr('Sem permissão: bash install.sh', 'No permission: bash install.sh', 'Sin permiso: bash install.sh'), dot: store.svc === 'ok' ? 'ok' : store.svc === 'checking' ? '' : 'warn'},
      {sym: 'home', name: 'FreeTV', sub: (ver ? 'v' + ver : '') + (newer ? tr(' · há a v' + latestVer, ' · v' + latestVer + ' is out', ' · ya está la v' + latestVer) : latestVer ? tr(' · em dia', ' · up to date', ' · al día') : ''), dot: newer ? 'warn' : ver ? 'ok' : ''}
    ];
  }

  function refreshHealth() {
    function again() { if (st.zone === Z.TILES && tileSheet.kind === 'health') { tileSheet.defs = healthTiles(); renderTiles(); } }
    if (store.svc === 'none' || store.svc === 'off') svcCheck();
    svcUpdates(again);
    privacyCheck(again);
    versionCheck(again);
    commLoad(again);
    if (dev.hours === null) devTick(0, again);
  }

  // --- the sleep timer: 15, 30, 60, 90 minutes, a warning with 30 seconds left, any key cancels it

  var sleep = {end: 0, timer: 0, warning: false, preset: 0};

  function sleepCancel(quiet) {
    clearTimeout(sleep.timer);
    sleep.end = 0;
    sleep.warning = false;
    sleep.preset = 0;
    if (!quiet) toast(tr('Temporizador desligado', 'Sleep timer off', 'Temporizador apagado'));
  }

  function sleepSet(minutes) {
    clearTimeout(sleep.timer);
    sleep.warning = false;
    sleep.end = Date.now() + minutes * 60000;
    sleep.timer = setTimeout(function () {
      sleep.warning = true;
      toast(tr('A TV vai desligar em 30 segundos. Aperte qualquer botão para cancelar.', 'The TV turns off in 30 seconds. Press any button to cancel.', 'La tele se apaga en 30 segundos. Pulsa cualquier botón para cancelar.'));
      sleep.timer = setTimeout(function () {
        sleep.end = 0;
        sleep.warning = false;
        TV.turnOff(function (ok) { if (!ok) toast(tr('Não consegui desligar a TV.', 'Could not turn the TV off.', 'No pude apagar la tele.')); });
      }, 30000);
    }, minutes * 60000 - 30000);
    toast(tr('A TV desliga em ' + minutes + ' minutos', 'The TV turns off in ' + minutes + ' minutes', 'La tele se apaga en ' + minutes + ' minutos'));
  }

  function sleepNext() {
    var presets = [0, 15, 30, 60, 90];
    sleep.preset = (sleep.preset + 1) % presets.length;
    if (!presets[sleep.preset]) sleepCancel(); else sleepSet(presets[sleep.preset]);
  }

  // --- search: apps, Custom channels, Store apps, and YouTube AdFree's own search

  var searchQuery = '';

  function openSearch() {
    showDialog.icon = 'search';
    showDialog(tr('Procurar', 'Search', 'Buscar'), [
      {text: tr('Escreva com o teclado da TV e aperte Enter.', 'Type with the TV keyboard and press Enter.', 'Escribe con el teclado de la tele y pulsa Intro.')}
    ], [{label: tr('Procurar', 'Search', 'Buscar'), run: function () { runSearch(searchQuery); }}, {label: cancelText()}], 0);
    var box = $('dialog').firstChild, input = document.createElement('input');
    input.type = 'text';
    input.className = 'chaninput';
    input.value = searchQuery;
    input.setAttribute('placeholder', tr('Ex.: Netflix, Bluey, Kodi…', 'E.g. Netflix, Bluey, Kodi…', 'Ej.: Netflix, Bluey, Kodi…'));
    input.oninput = function () { searchQuery = input.value; };
    input.onEnter = function (v) { searchQuery = v; runSearch(v); };
    box.insertBefore(input, box.querySelector('.row'));
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 250);
  }

  function runSearch(q) {
    q = String(q || '').replace(/^\s+|\s+$/g, '');
    if (!q) { openSearch(); return; }
    var ql = q.toLowerCase(), results = [];
    function has(t) { return String(t || '').toLowerCase().indexOf(ql) >= 0; }
    apps.forEach(function (a) { if (has(a.title) && !HIDDEN_RE.test(a.id)) results.push({label: a.title, run: launcher(a.id, a.title)}); });
    allChannels().forEach(function (c) { if (has(c.title)) results.push({label: c.title + '  ·  YouTube', run: function () { openChannel(c); }}); });
    commList.forEach(function (p) {
      if (!p.special && has(p.title)) results.push({label: p.title + '  ·  ' + tr('Loja', 'Store', 'Tienda'), run: function () {
        openCommunity(true);
        setTimeout(function () { var i = commList.indexOf(p); if (i >= 0) { commOpen = i; commAct = 0; st.comm = i; renderCommunity(); } }, 500);
      }});
    });
    if (findApp(YOUTUBE)) results.push({label: tr('Procurar «' + q + '» no YouTube', 'Search "' + q + '" on YouTube', 'Buscar «' + q + '» en YouTube'), run: function () {
      remember('app:' + YOUTUBE, 'YouTube AdFree');
      TV.launch(YOUTUBE, {contentTarget: {intent: 'SearchContent', intentParam: q}}, function (ok) { if (!ok) toast(tr('Não deu para abrir o YouTube', 'Could not open YouTube', 'No se pudo abrir YouTube')); });
    }});
    var buttons = results.slice(0, 7).map(function (r) { return {label: r.label, run: r.run}; });
    buttons.push({label: tr('Procurar outra coisa', 'Search for something else', 'Buscar otra cosa'), run: openSearch});
    buttons.push({label: cancelText()});
    showDialog(tr('Resultados', 'Results', 'Resultados'), results.length ? [] : [{text: tr('Nada com «' + q + '».', 'Nothing for "' + q + '".', 'Nada con «' + q + '».')}], buttons, 0);
  }

  // --- kids mode: only the Custom tab and the apps chosen for them; a 4-digit PIN leaves it (it keeps FreeTV's own screens from the little
  //     ones; it does not lock LG's other apps: holding Home for 2 seconds still goes to LG's home)

  var pin = {on: false, digits: '', title: '', text: '', cb: null};

  function askPin(title, text, cb) {
    pin = {on: true, digits: '', title: title, text: text, cb: cb};
    renderPin();
  }

  function renderPin() {
    var dots = '';
    for (var i = 0; i < 4; i++) dots += (i < pin.digits.length ? '●' : '○') + (i < 3 ? '  ' : '');
    showDialog.icon = 'lock';
    showDialog(pin.title, [{text: pin.text}, {cls: 'pin', text: dots}], [{label: cancelText(), run: function () { pin.on = false; }}], 0);
  }

  /** A digit key while the PIN is being asked; true when the key was for it. */
  function pinKey(k) {
    if (!pin.on) return false;
    var digit = k >= 48 && k <= 57 ? k - 48 : k >= 96 && k <= 105 ? k - 96 : -1;
    if (digit < 0) return false;
    pin.digits += digit;
    if (pin.digits.length < 4) { renderPin(); return true; }
    var cb = pin.cb, d = pin.digits;
    pin.on = false;
    closeDialog();
    cb(d);
    return true;
  }

  function kidsAllowed(app) { return TV.youtube.indexOf(app.id) >= 0 || app.id === YOUTUBE; }

  function kidsStart() {
    if (Prefs.kids()) { toast(tr('O modo crianças já está ligado', 'Kids mode is already on', 'El modo niños ya está activado')); return; }
    askPin(tr('Modo crianças: escolha um PIN', 'Kids mode: choose a PIN', 'Modo niños: elige un PIN'), tr('Digite 4 números com o controle. Com ele você sai do modo.', 'Type 4 digits with the remote. It is what leaves the mode.', 'Escribe 4 cifras con el mando. Con él sales del modo.'), function (first) {
      askPin(tr('Repita o PIN', 'Repeat the PIN', 'Repite el PIN'), tr('Os mesmos 4 números.', 'The same 4 digits.', 'Las mismas 4 cifras.'), function (second) {
        if (first !== second) { toast(tr('Os PINs não coincidem', 'The PINs do not match', 'Los PIN no coinciden')); return; }
        Prefs.set('kidsPin', first);
        Prefs.set('kidsSince', Date.now());
        Prefs.set('kids', true);
        kidsChanged();
        toast(tr('Modo crianças ligado', 'Kids mode on', 'Modo niños activado'));
      });
    });
  }

  function kidsExit() {
    askPin(tr('Sair do modo crianças', 'Leave kids mode', 'Salir del modo niños'), tr('Digite o PIN.', 'Type the PIN.', 'Escribe el PIN.'), function (d) {
      if (d !== Prefs.kidsPin()) { toast(tr('PIN incorreto', 'Wrong PIN', 'PIN incorrecto')); return; }
      Prefs.set('kids', false);
      Prefs.set('kidsSince', 0);
      kidsOver = false;
      kidsChanged();
      toast(tr('Modo crianças desligado', 'Kids mode off', 'Modo niños desactivado'));
    });
  }

  function kidsChanged() {
    applyLook();
    pickShelf();
    st.tab = 0;
    st.zone = Z.SHELF;
    st.shelf = 0;
    renderTop();
    renderCards();
    renderShelf();
    renderDrawer();
    updateFocus();
  }

  // --- first run: language, the tab to open on, and a look at LG's privacy (only on a TV that has no saved settings)

  function startOnboarding() {
    if (TV.name !== 'webos' || Prefs.onboarded()) return;
    function end() { Prefs.set('onboarded', true); }
    function step3() {
      showDialog(tr('Privacidade', 'Privacy', 'Privacidad'), [
        {text: tr('A LG pode escutar o que você vê para vender anúncios (ACR). O FreeTV não consegue desligar isso, mas diz se está ligado: Ajustes de início → Privacidade e crianças.',
            'LG\'s TV can listen to what you watch to sell ads (ACR). FreeTV cannot turn it off, but it tells you if it is on: Home Settings → Privacy and kids.',
            'La tele de LG puede escuchar lo que ves para vender anuncios (ACR). FreeTV no puede apagarlo, pero te dice si está activo: Ajustes de inicio → Privacidad y niños.')}
      ], [{label: tr('Entendi', 'Got it', 'Entendido'), run: end}], 0);
    }
    function step2() {
      var names = tabNames();
      showDialog(tr('Com qual aba abrir?', 'Which tab to open on?', '¿Con qué pestaña abrir?'), [], [0, 2, 1].map(function (i) {
        return {label: names[i], run: function () { Prefs.set('startTab', i); step3(); }};
      }).concat([{label: tr('A última que usei', 'The last one I used', 'La última que usé'), run: function () { Prefs.set('startTab', 'last'); step3(); }}]), 0);
    }
    var langs = [['es', 'Español'], ['en', 'English'], ['pt', 'Português'], ['de', 'Deutsch'], ['ru', 'Русский']];
    showDialog('FreeTV', [{text: 'Language · Idioma · Idioma'}], langs.map(function (l) {
      return {label: l[1], run: function () { Prefs.set('language', l[0]); I18N.set(l[0]); renderAll(); step2(); }};
    }), 0);
  }

  // MARK: - Developer Mode: how long the session has left, and keeping it going. LG's session lasts 1000 hours (about 41 days) and its
  // EXTEND button asks LG for 1000 more: the store service (on the TV, through its own Developer Mode shell) does the same ask when less
  // than 14 days are left. The session token never leaves the TV.

  var dev = {hours: null, ok: true, error: '', history: [], at: 0, busy: false, extended: false};

  function devDays(h) {
    var d = Math.floor(h / 24);
    return d >= 2 ? tr(d + ' dias', d + ' days', d + ' días') : tr(Math.round(h) + ' horas', Math.round(h) + ' hours', Math.round(h) + ' horas');
  }

  function devText() {
    if (dev.hours === null) return dev.busy ? '…' : (dev.error ? '!' : '›');
    return devDays(dev.hours) + (dev.ok ? '' : ' !');
  }

  /** Asks the store service; it extends only when less than `below` hours are left (0: just look). */
  function devTick(below, done) {
    if (TV.name !== 'webos' || dev.busy) { if (done) done(dev); return; }
    dev.busy = true;
    svcCall('devmode', {below: below}, function (r) {
      dev.busy = false;
      dev.at = Date.now();
      if (r && r.returnValue) {
        if (typeof r.hours === 'number') dev.hours = r.hours;
        dev.ok = !!r.ok;
        dev.error = r.error || '';
        dev.extended = !!r.extended;
        dev.history = r.history || dev.history;
      } else {
        dev.ok = false;
        dev.error = r && r.error === 'sin permiso' ? tr('Falta o acesso da loja: bash install.sh no computador.', 'The store permission is missing: bash install.sh on the computer.', 'Falta el permiso de la tienda: bash install.sh en el ordenador.')
            : (r && r.error) || tr('A TV não respondeu.', 'The TV did not answer.', 'La tele no respondió.');
      }
      if (done) done(dev);
    });
  }

  function devAuto() {
    devTick(Prefs.devAuto() ? 336 : 0, function (d) {
      if (d.extended) toast(tr('Modo Desenvolvedor renovado: ', 'Developer Mode renewed: ', 'Modo Desarrollador renovado: ') + devDays(d.hours));
      else if (d.hours !== null && d.hours < 120) toast(tr('Modo Desenvolvedor: restam ', 'Developer Mode: ', 'Modo Desarrollador: quedan ') + devDays(d.hours) +
          (d.ok ? '' : tr('. Abra o app Developer Mode e toque em EXTEND.', '. Open the Developer Mode app and press EXTEND.', '. Abre la app Developer Mode y pulsa EXTEND.')));
    });
  }

  function openDevMode() {
    var title = tr('Modo Desenvolvedor', 'Developer Mode', 'Modo Desarrollador');
    var token = showDialog(title, [{text: tr('Perguntando à LG…', 'Asking LG…', 'Preguntando a LG…')}], [], 0);
    devTick(0, function (d) {
      if (dlg.token !== token || st.zone !== Z.DLG) return;   // closed meanwhile
      var lines = [];
      if (d.hours !== null) lines.push({text: tr('Restam ', 'Left: ', 'Quedan ') + devDays(d.hours) + tr(' de sessão (a LG dá 1000 horas e renova até 1000).', ' of session (LG gives 1000 hours and renews up to 1000).', ' de sesión (LG da 1000 horas y se renueva hasta 1000).')});
      if (!d.ok) lines.push({cls: 'warn', text: d.error});
      lines.push({text: Prefs.devAuto()
          ? tr('A TV renova sozinha quando restam menos de 14 dias.', 'The TV renews it by itself when less than 14 days are left.', 'La tele la renueva sola cuando quedan menos de 14 días.')
          : tr('A renovação automática está desligada: use «Renovar agora» ou o botão EXTEND do app Developer Mode.', 'Automatic renewal is off: use "Renew now" or the EXTEND button of the Developer Mode app.', 'La renovación automática está apagada: usa «Renovar ahora» o el botón EXTEND de la app Developer Mode.')});
      var hist = (d.history || []).slice(-4).reverse();
      hist.forEach(function (h) {
        var when = new Date(h.at);
        lines.push({text: when.toLocaleDateString(I18N.locale(), {day: 'numeric', month: 'short'}) + '  ' +
            (h.extended ? tr('renovado', 'renewed', 'renovado') : h.ok ? tr('conferido', 'checked', 'comprobado') : tr('falhou', 'failed', 'falló')) +
            (typeof h.hours === 'number' ? '  ·  ' + devDays(h.hours) : '')});
      });
      showDialog(title, lines, [
        {label: tr('Renovar agora', 'Renew now', 'Renovar ahora'), run: function () {
          devTick(100000, function (r) {
            toast(r.extended ? tr('Renovado: ', 'Renewed: ', 'Renovado: ') + devDays(r.hours) : (r.error || tr('Não foi possível renovar.', 'Could not renew.', 'No se pudo renovar.')));
            if (st.zone === Z.SETTINGS) renderSettings();
          });
        }},
        {label: tr('Fechar', 'Close', 'Cerrar')}
      ], 0);
    });
  }

  /** The automatic update (Home Settings, off until the person turns it on): once a day, in the background, only what is installed. */
  function autoUpdate() {
    if (TV.name !== 'webos' || !Prefs.autoUpdate() || Date.now() - Prefs.updCheckedAt() < 24 * 3600 * 1000) return;
    Prefs.set('updCheckedAt', Date.now());
    svcCall('updateAll', {}, function (r) {
      if (!r || !r.returnValue) return;
      svcPollAll(function (batch) {
        if (!batch) return;
        if (batch.done) {
          toast(tr('Apps atualizadas: ', 'Apps updated: ', 'Apps actualizadas: ') + batch.done);
          svcApps(function () { loadApps(function () { renderShelf(); renderDrawer(); updateFocus(); }); });
        }
        svcUpdates();
      });
    });
  }

  // One line about the apps people look for most, in their language (the catalogue's are in English, and some have none).
  var COMM_DESC = {
    'youtube.leanback.v4': ['YouTube sem anúncios, com SponsorBlock', 'YouTube without ads, with SponsorBlock', 'YouTube sin anuncios, con SponsorBlock'],
    'twitch.adamffdev.v1': ['Twitch sem anúncios', 'Twitch without ads', 'Twitch sin anuncios'],
    'org.jellyfin.webos': ['Seus filmes e séries do seu servidor Jellyfin', 'Your films and shows from your Jellyfin server', 'Tus pelis y series desde tu servidor Jellyfin'],
    'org.xbmc.kodi': ['Centro multimídia livre: vídeos, música, extensões', 'Free media centre: videos, music, add-ons', 'Centro multimedia libre: vídeos, música, complementos'],
    'com.limelight.webos': ['Jogue os jogos do seu PC na TV (GameStream/Sunshine)', 'Play your PC games on the TV (GameStream/Sunshine)', 'Juega a los juegos de tu PC en la tele (GameStream/Sunshine)'],
    'com.beb.plxnative': ['Cliente Plex nativo, não oficial', 'Native Plex client, unofficial', 'Cliente de Plex nativo, no oficial'],
    'com.retroarch.webos': ['Emuladores de consolas clássicas', 'Classic console emulators', 'Emuladores de consolas clásicas'],
    'org.webosbrew.hbchannel': ['A loja original do webOS Homebrew', 'The original webOS Homebrew store', 'La tienda original de webOS Homebrew'],
    'org.webosbrew.safeupdate': ['Atualiza o Homebrew Channel com segurança', 'Updates the Homebrew Channel safely', 'Actualiza el Homebrew Channel de forma segura'],
    'com.pirate.refresh': ['Renova o Modo Desenvolvedor sozinho (o FreeTV já faz isso)', 'Renews Developer Mode by itself (FreeTV already does)', 'Renueva el Modo Desarrollador solo (FreeTV ya lo hace)'],
    'com.github.cfernande1470.wireguard': ['VPN WireGuard na TV', 'WireGuard VPN on the TV', 'VPN WireGuard en la tele'],
    'com.willinux.tvh.app': ['Cliente para o seu servidor TVHeadend', 'Client for your TVHeadend server', 'Cliente para tu servidor TVHeadend'],
    'me.mariotaku.gallery3d': ['Galeria de fotos em 3D', '3D photo gallery', 'Galería de fotos en 3D'],
    'org.rchalaaa.webos.custom-screensaver': ['Protetor de tela com vídeos aéreos', 'Screensaver with aerial videos', 'Salvapantallas con vídeos aéreos'],
    'ooo.lew.lifesgoodwithoutspying': ['Desliga a espionagem da LG (precisa de root)', 'Turns off the spying on LG TVs (needs root)', 'Apaga el espionaje de LG (necesita root)'],
    'com.immich.webos': ['Suas fotos e vídeos do Immich', 'Your photos and videos from Immich', 'Tus fotos y vídeos de Immich']
  };

  function commDesc(p) {
    var d = COMM_DESC[p.id];
    return d ? tr(d[0], d[1], d[2]) : p.shortDescription || (p.manifest && p.manifest.appDescription) || '';
  }

  /** The app's icon from the catalogue (an image on the web); a soft square with its first letter when it has none or it fails. */
  function commIcon(p, parent, cls) {
    var holder = el('div', cls, parent), url = p.iconUri || (p.manifest && p.manifest.iconUri) || '';
    var letter = el('span', 'cletter', holder, (p.title || '?').charAt(0).toUpperCase());
    if (!/^https:\/\//.test(url)) return holder;
    var img = el('img', '', holder);
    img.onload = function () { letter.style.visibility = 'hidden'; };
    img.onerror = function () { img.parentNode.removeChild(img); };
    img.src = url;
    return holder;
  }

  function renderDetail(box) {
    var a = commList[commOpen], m = a.manifest, req = a.requirements || {}, mine = store.id === a.id ? store.flow : 'idle';
    commActs = [];
    if (a.special) { renderUpdateAll(box); return; }
    var upd = store.svc === 'ok' ? store.updates[a.id] : null;
    var warn = upd && COMM_FLAG[a.id] === 'official-removed' ? null : COMM_CAUTION[a.id], cmd = 'python3 tools/community.py serve <IP>';
    var head = line(box, 'dhead', '');
    commIcon(a, head, 'dico');
    head.appendChild(el('b', '', null, a.title + '  ·  v' + (m.version || '?')));
    if (mine === 'asking') {
      if (store.svc === 'ok') line(box, '', tr('A própria TV baixa o pacote, confere o hash SHA-256 e instala. Não precisa do computador. Leva alguns minutos.',
          'The TV itself downloads the package, checks its SHA-256 hash and installs it. No computer needed. It takes a few minutes.',
          'La propia tele descarga el paquete, comprueba su hash SHA-256 y lo instala. No hace falta el ordenador. Tarda unos minutos.'));
      else line(box, '', tr('O computador baixa o pacote, confere o hash SHA-256 e instala na TV. Leva alguns minutos.',
          'Your computer downloads the package, checks its SHA-256 hash and installs it on the TV. It takes a few minutes.',
          'Tu ordenador descarga el paquete, comprueba su hash SHA-256 y lo instala en la tele. Tarda unos minutos.'));
      if (warn) line(box, 'warn', tr(warn[0], warn[1], warn[2]));
      var go = upd ? tr('Atualizar', 'Update', 'Actualizar') : warn ? (COMM_FLAG[a.id] === 'official-removed' ? tr('Já apaguei o oficial: instalar', 'I deleted the official: install', 'Ya borré el oficial: instalar')
          : tr('Entendi o aviso: instalar', 'I understand: install', 'Entendido: instalar')) : tr('Instalar', 'Install', 'Instalar');
      var stop = tr('Cancelar', 'Cancel', 'Cancelar');
      // With a warning, OK lands on Cancel first.
      if (warn) { action(box, stop, function () { store.flow = 'idle'; commAct = 0; renderCommunity(); }); action(box, go, function () { storeInstall(a); }); }
      else { action(box, go, function () { storeInstall(a); }); action(box, stop, function () { store.flow = 'idle'; commAct = 0; renderCommunity(); }); }
    } else if (mine === 'working') {
      line(box, '', phaseText(store.phase));
      line(box, '', store.via === 'tv' ? tr('Não desligue a TV. Voltar deixa a instalação continuar.', 'Do not turn the TV off. Back lets the install carry on.', 'No apagues la tele. Atrás deja que siga instalándose.')
          : tr('Não desligue a TV nem o computador. Voltar deixa a instalação continuar.', 'Do not turn off the TV or the computer. Back lets the install carry on.', 'No apagues la tele ni el ordenador. Atrás deja que siga instalándose.'));
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
      line(box, '', commDesc(a));
      if (upd) line(box, 'good', tr('Atualização disponível (v' + upd.from + ' → v' + upd.to + '). As apps e seus ajustes são mantidos.',
          'Update available (v' + upd.from + ' → v' + upd.to + '). The app and its settings are kept.',
          'Actualización disponible (v' + upd.from + ' → v' + upd.to + '). La app y sus ajustes se conservan.'));
      else if (instMap()[a.id] !== undefined) {
        var iv = instMap()[a.id], sz = store.sizes[a.id] ? tr(' · ocupa ' + store.sizes[a.id] + ' MB', ' · takes ' + store.sizes[a.id] + ' MB', ' · ocupa ' + store.sizes[a.id] + ' MB') : '';
        line(box, 'good', iv ? tr('Instalada: v' + iv + ' · em dia' + sz + '.', 'Installed: v' + iv + ' · up to date' + sz + '.', 'Instalada: v' + iv + ' · al día' + sz + '.')
            : tr('Instalada' + sz + '.', 'Installed' + sz + '.', 'Instalada' + sz + '.'));
      }
      line(box, '', tr('Precisa de: ', 'Needs: ', 'Necesita: ') + (req.webosRelease ? 'webOS ' + req.webosRelease : tr('nada especial', 'nothing special', 'nada especial')) +
          (req.deviceSoC ? ' · chip ' + req.deviceSoC.join(', ') : ''));
      if (warn) line(box, 'warn', tr(warn[0], warn[1], warn[2]));
      if (m.sourceUrl) line(box, '', tr('Código: ', 'Code: ', 'Código: ') + m.sourceUrl);
      if (m.rootRequired) line(box, 'warn', tr('Precisa de root: o FreeTV não instala isto.', 'Needs root: FreeTV does not install this.', 'Necesita root: FreeTV no la instala.'));
      else if ((store.svc === 'ok' || store.conn === 'ok') && store.flow === 'working') line(box, '', tr('Há outra instalação em andamento.', 'Another install is in progress.', 'Hay otra instalación en marcha.'));
      else if (store.svc === 'ok' || store.conn === 'ok') {
        action(box, upd ? tr('Atualizar nesta TV', 'Update on this TV', 'Actualizar en esta tele') : tr('Instalar nesta TV', 'Install on this TV', 'Instalar en esta tele'), function () {
          store.flow = 'asking'; store.id = a.id; commAct = 0; renderCommunity();
        });
      } else if (store.svc === 'checking' || store.conn === 'checking') line(box, '', tr('Preparando a instalação…', 'Getting the install ready…', 'Preparando la instalación…'));
      else {
        line(box, '', store.svc === 'off' ? tr('A loja da TV está instalada, mas não consegue abrir o Modo Desenvolvedor. Ele está ligado? Se a chave mudou, no computador execute:', 'The TV store is installed but cannot open Developer Mode. Is it on? If the key changed, on the computer run:', 'La tienda de la tele está instalada pero no consigue abrir el Modo Desarrollador. ¿Está activado? Si la clave cambió, en el ordenador ejecuta:')
            : tr('Para instalar daqui, sem o computador, execute uma vez no computador (e diga que sim à loja):', 'To install from here with no computer, run once on the computer (and say yes to the store):', 'Para instalar desde aquí, sin ordenador, ejecuta una vez en el ordenador (y di que sí a la tienda):'));
        line(box, 'code', 'bash install.sh <IP>');
        line(box, '', tr('Ou, com o computador ligado, execute:', 'Or, with the computer on, run:', 'O, con el ordenador encendido, ejecuta:'));
        line(box, 'code', cmd);
        action(box, tr('Verificar de novo', 'Check again', 'Comprobar de nuevo'), function () { svcCheck(); storeCheck(); renderCommunity(); });
      }
    }
    if (['asking', 'working', 'done', 'failed'].indexOf(mine) < 0) {
      if (m.ipkSize) {
        var mb = Math.max(1, Math.round(m.ipkSize / 1048576)), fits = !store.freeMb || store.freeMb > mb * 2 + 20;
        line(box, fits ? '' : 'warn', tr('Tamanho: ', 'Size: ', 'Tamaño: ') + mb + ' MB' + (store.freeMb ? (fits ? tr(' · cabe (livres ' + store.freeMb + ' MB)', ' · fits (' + store.freeMb + ' MB free)', ' · cabe (libres ' + store.freeMb + ' MB)')
            : tr(' · pode não caber (livres ' + store.freeMb + ' MB)', ' · may not fit (' + store.freeMb + ' MB free)', ' · puede no caber (libres ' + store.freeMb + ' MB)')) : ''));
      }
      if (a.repo) line(box, 'warn', tr('Vem do repositório ', 'From the repository ', 'Viene del repositorio ') + a.repo);
      var gh = /github\.com\/([\w.-]+)\/([\w.-]+)/.exec(m.sourceUrl || '');
      if (gh && commNotes[a.id] === undefined) {
        commNotes[a.id] = '';
        Data.getJson('https://api.github.com/repos/' + gh[1] + '/' + gh[2].replace(/\.git$/, '') + '/releases/latest', function (err, rel) {
          commNotes[a.id] = !err && rel && rel.body ? rel.body.replace(/[#*`>_\[\]]/g, '').replace(/\(http[^)]*\)/g, '').replace(/\s+/g, ' ').slice(0, 260) : '';
          if (commNotes[a.id] && st.zone === Z.COMM && commList[commOpen] === a) renderCommunity();
        });
      }
      if (commNotes[a.id]) line(box, '', tr('Novidades: ', 'What\'s new: ', 'Novedades: ') + commNotes[a.id] + (commNotes[a.id].length >= 260 ? '…' : ''));
      var wished = wish().indexOf(a.id) >= 0;
      action(box, wished ? tr('Tirar da minha lista', 'Remove from my list', 'Quitar de mi lista') : tr('Guardar na minha lista', 'Save to my list', 'Guardar en mi lista'), function () {
        Prefs.set('wish', wished ? wish().filter(function (x) { return x !== a.id; }) : wish().concat([a.id]));
        renderCommunity();
      });
      if (instMap()[a.id] !== undefined && !PROTECTED.test(a.id)) action(box, tr('Desinstalar', 'Uninstall', 'Desinstalar'), function () { confirmRemove({id: a.id, title: a.title}); });
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
    el('div', 'hint', box, store.svc === 'ok'
        ? tr('Pronto: na ficha de cada app (sem root) a TV instala sozinha, sem computador.', 'Ready: each app without root is installed by the TV itself from its page, no computer.', 'Listo: en la ficha de cada app (sin root) la propia tele la instala, sin ordenador.')
        : store.conn === 'ok'
        ? tr('Computador conectado: na ficha de cada app (sem root) dá para instalar.', 'Computer connected: each app without root can be installed from its page.', 'Ordenador conectado: en la ficha de cada app (sin root) se puede instalar.')
        : tr('Do catálogo webOS Homebrew. Para instalar daqui, conecte o computador (veja qualquer ficha).',
            'From the webOS Homebrew catalogue. To install from here, connect the computer (see any app page).',
            'Del catálogo webOS Homebrew. Para instalar desde aquí, conecta el ordenador (mira cualquier ficha).')).style.marginBottom = '14px';
    if (store.freeMb) box.lastChild.textContent += '  ·  ' + tr('Espaço livre: ', 'Free space: ', 'Espacio libre: ') + store.freeMb + ' MB';
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    holder.setAttribute('data-pitch', 112);
    holder.setAttribute('data-visible', 5);
    list.style.height = Math.min(commList.length, 5) * 112 + 'px';
    for (var i = 0; i < commList.length; i++) {
      var p = commList[i], row = el('div', 'row crow' + (p.ctl ? ' ctl' : ''), holder);
      if (p.ctl) {
        sym(['search', 'apps', 'sync'][p.ctl - 1], el('div', 'cico csym', row));
        el('div', 'ctitle', row, [tr('Procurar', 'Search', 'Buscar'), tr('Mostrar', 'Show', 'Mostrar'), tr('Ordenar', 'Order', 'Ordenar')][p.ctl - 1]);
        el('div', 'cdesc', row, p.ctl === 1 ? (commQuery ? '«' + commQuery + '»' : tr('Por nome ou assunto', 'By name or subject', 'Por nombre o tema'))
            : p.ctl === 2 ? filterName(Prefs.opt('commFilter', 'all')) + ' · ' + (commList.length - 3 - (commList[3] && commList[3].special ? 1 : 0)) + ' apps'
            : sortName(Prefs.opt('commSort', 'rec')));
        el('span', 'value', row, p.ctl === 1 ? '›' : '‹ ›');
        hover(row, Z.COMM, i);
        continue;
      }
      if (p.special) sym('apps', el('div', 'cico csym', row));
      else commIcon(p, row, 'cico');
      el('div', 'ctitle', row, p.title);
      el('div', 'cdesc', row, p.special ? tr('Atualiza de uma vez as apps que você já tem', 'Brings the apps you have up to date in one go', 'Pone al día de una vez las apps que ya tienes')
          : commDesc(p));
      var v = el('span', 'value', row);
      var root = !!p.manifest.rootRequired;
      if (p.special) el('span', 'tag upd', v, tr('novas versões', 'new versions', 'nuevas versiones'));
      else {
        var have = commInst[p.id];
        if (store.updates[p.id]) el('span', 'tag upd', v, tr('atualização ', 'update ', 'actualización ') + store.updates[p.id].to);
        else if (have !== undefined) el('span', 'tag ok', v, '✓ ' + (have ? 'v' + have + ' · ' : '') + (isNewerVersion(p.manifest.version, have) ? tr('há uma nova', 'newer exists', 'hay una nueva') : tr('em dia', 'up to date', 'al día')));
        if (have !== undefined && store.updates[p.id]) el('span', 'tag ok', v, 'v' + have + '  ');
        if (have === undefined) el('span', 'tag' + (root ? ' root' : ''), v, root ? 'root' : tr('sem root', 'no root', 'sin root'));
        if (commIsNew(p)) el('span', 'tag new', v, tr('Nova', 'New', 'Nueva'));
        else if (FEATURED.indexOf(p.id) >= 0 && have === undefined) el('span', 'tag star', v, '★');
        if (wish().indexOf(p.id) >= 0) el('span', 'tag star', v, '♥');
      }
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
      if (kidsOver && Prefs.kids()) { checkKidsLimit(); toast(tr('Acabou o tempo de TV', 'TV time is over', 'Se acabó el tiempo de tele')); return; }
      if (id === 'freetv.store') { openCommunity(true); return; }
      if (id.indexOf('chan:') === 0) {
        var ch = allChannels().filter(function (c) { return 'chan:' + c.key === id; })[0];
        if (ch) openChannel(ch);
        return;
      }
      if (id.indexOf('com.gathin.') !== 0) usageStart(id);
      if (id.indexOf('tizenbrew:') === 0) { remember('app:' + id, name || id); openBrewApp(id.slice(10), name || id); return; }
      if (id.indexOf('com.gathin.') !== 0 && id !== 'com.local.nativehome') remember('app:' + id, name || id);
      TV.launch(id, null, function (ok) {
        if (!ok) toast(tr('Não deu para abrir ', "Couldn't open ", 'No se pudo abrir ') + (name || id));
      });
    };
  }

  // MARK: - Dialog: a small box with some text and buttons (OK chooses, Back closes)

  var dlg = {acts: [], index: 0, from: Z.APPS, token: 0};

  /** lines: [{text, cls}], buttons: [{label, run}]. A button closes the box and then runs (it may open another one). */
  function showDialog(title, lines, buttons, index) {
    if (st.zone !== Z.DLG) dlg.from = st.zone;
    var box = $('dialog').firstChild;
    box.innerHTML = '';
    var head = el('div', 'title', box);
    sym(showDialog.icon || 'apps', head);
    showDialog.icon = null;
    head.appendChild(document.createTextNode(title));
    for (var i = 0; i < lines.length; i++) line(box, lines[i].cls || '', lines[i].text);
    dlg.acts = [];
    dlg.token++;
    for (var b = 0; b < buttons.length; b++) {
      (function (n, button) {
        var row = el('div', 'row', box, button.label);
        dlg.acts.push(button.run || function () {});
        row.onmouseover = function () { if (st.zone === Z.DLG && dlg.index !== n) { dlg.index = n; updateFocus(); } };
        row.onclick = function () { dlg.index = n; updateFocus(); activate(); };
      })(b, buttons[b]);
    }
    dlg.index = index || 0;
    st.zone = Z.DLG;
    setClass($('dialog'), 'open', true);
    updateFocus();
    return dlg.token;
  }

  function closeDialog() {
    pin.on = false;
    dlg.token++;
    setClass($('dialog'), 'open', false);
    st.zone = dlg.from;
    updateFocus();
  }

  function cancelText() { return tr('Cancelar', 'Cancel', 'Cancelar'); }

  // MARK: - Samsung: community apps are TizenBrew's modules (tizenbrew.js). FreeTV lists them, adds or removes them in TizenBrew
  // (with a question first: they are other people's code) and opens them in TizenBrew.

  var brewQuery = '';

  function brewText(m) { return m.about instanceof Array ? tr(m.about[0], m.about[1], m.about[2]) : (m.about || ''); }

  function brewClosedText() {
    return tr('O TizenBrew precisa estar aberto para ver ou adicionar módulos: abra-o uma vez (botão abaixo), volte ao FreeTV com Home e entre aqui de novo. Ele fica aberto até desligar a TV.',
      'TizenBrew has to be open to see or add modules: open it once (button below), come back to FreeTV with Home and come in here again. It stays open until the TV is turned off.',
      'TizenBrew tiene que estar abierto para ver o añadir módulos: ábrelo una vez (botón de abajo), vuelve a FreeTV con Home y entra aquí otra vez. Se queda abierto hasta que apagues la tele.');
  }

  function openBrew() {
    TizenBrew.launch(null, function (ok) { if (!ok) toast(tr('Não deu para abrir o TizenBrew', "Couldn't open TizenBrew", 'No se pudo abrir TizenBrew')); });
  }

  /** The Store on Samsung: TizenBrew's modules (the recommended ones, a search on npm, or any name). */
  function openModules() {
    var title = commTitle();
    if (!TizenBrew.installed(apps)) {
      showDialog(title, [
        {text: tr('Na Samsung, as apps da comunidade (YouTube e Twitch sem anúncios e muitas mais) funcionam dentro do TizenBrew, um app gratuito da comunidade.',
          'On Samsung, community apps (YouTube and Twitch without ads, and many more) run inside TizenBrew, a free community app.',
          'En Samsung, las apps de la comunidad (YouTube y Twitch sin anuncios, y muchas más) funcionan dentro de TizenBrew, una app gratuita de la comunidad.')},
        {text: tr('Instale-o uma vez com o TizenBrew Installer, no computador ou num celular Android: github.com/reisxd/TizenBrewInstaller. Depois, YouTube AdFree e Twitch AdFree aparecem aqui sozinhos.',
          'Install it once with TizenBrew Installer, on a computer or an Android phone: github.com/reisxd/TizenBrewInstaller. Then YouTube AdFree and Twitch AdFree show up here by themselves.',
          'Instálalo una vez con TizenBrew Installer, desde un ordenador o un móvil Android: github.com/reisxd/TizenBrewInstaller. Después, YouTube AdFree y Twitch AdFree aparecen aquí solos.')}
      ], [{label: 'OK'}], 0);
      return;
    }
    var token = showDialog(title, [{text: tr('Perguntando ao TizenBrew…', 'Asking TizenBrew…', 'Preguntando a TizenBrew…')}], [], 0);
    TizenBrew.modules(function (err, have) {
      if (dlg.token !== token || st.zone !== Z.DLG) return;   // closed meanwhile
      var lines = [{text: tr('Módulos do TizenBrew: são de outras pessoas, o FreeTV pergunta antes de adicionar um.',
        "TizenBrew's modules: they are other people's, FreeTV asks before adding one.", 'Módulos de TizenBrew: son de otras personas, FreeTV pregunta antes de añadir uno.')}];
      if (err) lines.push({cls: 'warn', text: brewClosedText()});
      var buttons = TizenBrew.RECOMMENDED.map(function (m) {
        var on = have && have.indexOf(m.full) >= 0;
        return {label: (on ? '✓ ' : '') + m.title, run: function () { openModule(m, have); }};
      });
      buttons.push({label: tr('Procurar mais…', 'Search for more…', 'Buscar más…'), run: function () { askModuleText('search', have); }});
      buttons.push({label: tr('Adicionar pelo nome…', 'Add by name…', 'Añadir por nombre…'), run: function () { askModuleText('name', have); }});
      buttons.push({label: tr('Abrir o TizenBrew', 'Open TizenBrew', 'Abrir TizenBrew'), run: openBrew});
      buttons.push({label: cancelText()});
      showDialog(title, lines, buttons, 0);
    });
  }

  /** A text box (the TV's keyboard): a search on npm, or a module's name as TizenBrew takes it (npm/<package>, gh/<user>/<repo>). */
  function askModuleText(kind, have) {
    var search = kind === 'search';
    showDialog(search ? tr('Procurar módulos', 'Search modules', 'Buscar módulos') : tr('Adicionar pelo nome', 'Add by name', 'Añadir por nombre'), [
      {text: search ? tr('Escreva o que procura (ex.: iptv, twitch) e aperte Enter.', 'Type what you are looking for (e.g. iptv, twitch) and press Enter.',
          'Escribe lo que buscas (ej.: iptv, twitch) y pulsa Intro.')
        : tr('Como o TizenBrew o pede: npm/<pacote> ou gh/<usuário>/<repositório> (do GitHub).', 'As TizenBrew wants it: npm/<package> or gh/<user>/<repository> (from GitHub).',
          'Como lo pide TizenBrew: npm/<paquete> o gh/<usuario>/<repositorio> (de GitHub).')}
    ], [{label: search ? tr('Procurar', 'Search', 'Buscar') : tr('Continuar', 'Continue', 'Seguir'), run: function () {
      var q = brewQuery.replace(/^\s+|\s+$/g, '');
      if (!q) { openModules(); return; }
      if (search) { searchModules(q, have); return; }
      if (!TizenBrew.parse(q)) { toast(tr('Nome não válido', 'Not a valid name', 'Nombre no válido')); askModuleText('name', have); return; }
      openModule({full: q, title: q.replace(/^(npm|gh)\//, ''), about: ''}, have);
    }}, {label: cancelText()}], 0);
    var box = $('dialog').firstChild, input = document.createElement('input');
    input.type = 'text';
    input.className = 'chaninput';
    input.value = brewQuery;
    input.setAttribute('placeholder', search ? 'iptv' : 'npm/@jjg0/twizen');
    input.oninput = function () { brewQuery = input.value; };
    box.insertBefore(input, box.querySelector('.row'));
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 250);   // the TV opens its keyboard
  }

  function searchModules(q, have) {
    var title = tr('Procurar módulos', 'Search modules', 'Buscar módulos');
    var token = showDialog(title, [{text: tr('Procurando «' + q + '»…', 'Looking for «' + q + '»…', 'Buscando «' + q + '»…')}], [], 0);
    TizenBrew.search(q, function (err, found) {
      if (dlg.token !== token || st.zone !== Z.DLG) return;
      if (err || !found.length) {
        showDialog(title, [{cls: 'warn', text: err ? tr('Sem conexão com a busca.', 'The search did not answer.', 'La búsqueda no respondió.')
          : tr('Nada encontrado.', 'Nothing found.', 'No he encontrado nada.')}],
          [{label: tr('Procurar outro', 'Search again', 'Buscar otro'), run: function () { askModuleText('search', have); }}, {label: cancelText()}], 0);
        return;
      }
      var buttons = found.slice(0, 7).map(function (m) {
        return {label: (have && have.indexOf(m.full) >= 0 ? '✓ ' : '') + m.title, run: function () { openModule(m, have); }};
      });
      buttons.push({label: tr('Procurar outro', 'Search again', 'Buscar otro'), run: function () { askModuleText('search', have); }});
      buttons.push({label: cancelText()});
      showDialog(tr('Escolha o módulo', 'Pick the module', 'Elige el módulo'), [], buttons, 0);
    });
  }

  /** One module: open it, or add it (a question first) / take it out of TizenBrew. */
  function openModule(m, have) {
    var on = have && have.indexOf(m.full) >= 0, lines = [];
    if (brewText(m)) lines.push({text: brewText(m)});
    lines.push({cls: 'code', text: m.full});
    var buttons = [];
    if (on || m.full === 'npm/@foxreis/tizentube') buttons.push({label: tr('Abrir', 'Open', 'Abrir'), run: function () { openBrewApp(m.full, m.title); }});
    if (on) buttons.push({label: tr('Tirar do TizenBrew', 'Remove from TizenBrew', 'Quitar de TizenBrew'), run: function () { brewChange('remove', m); }});
    else buttons.push({label: tr('Adicionar ao TizenBrew', 'Add to TizenBrew', 'Añadir a TizenBrew'), run: function () { confirmBrewAdd(m, false); }});
    buttons.push({label: cancelText()});
    showDialog(m.title, lines, buttons, 0);
  }

  function confirmBrewAdd(m, thenOpen) {
    showDialog(m.title, [{cls: 'warn', text: tr('É código de outra pessoa, que o TizenBrew vai baixar e rodar na sua TV. O FreeTV não o revisa. Adicionar?',
      "It is someone else's code, which TizenBrew will download and run on your TV. FreeTV does not review it. Add it?",
      'Es código de otra persona, que TizenBrew descargará y ejecutará en tu tele. FreeTV no lo revisa. ¿Añadirlo?')}],
      [{label: cancelText()}, {label: tr('Sim, adicionar', 'Yes, add it', 'Sí, añadirlo'), run: function () { brewChange('add', m, thenOpen); }}], 0);
  }

  function brewChange(action, m, thenOpen) {
    var token = showDialog(m.title, [{text: tr('Falando com o TizenBrew…', 'Talking to TizenBrew…', 'Hablando con TizenBrew…')}], [], 0);
    TizenBrew[action](m.full, function (err) {
      if (err) {
        if (dlg.token === token && st.zone === Z.DLG) {
          showDialog(m.title, [{cls: 'warn', text: brewClosedText()}], [{label: tr('Abrir o TizenBrew', 'Open TizenBrew', 'Abrir TizenBrew'), run: openBrew}, {label: cancelText()}], 0);
        }
        return;
      }
      if (dlg.token === token && st.zone === Z.DLG) closeDialog();
      toast(m.title + ': ' + (action === 'add' ? tr('adicionado ao TizenBrew', 'added to TizenBrew', 'añadido a TizenBrew') : tr('tirado do TizenBrew', 'removed from TizenBrew', 'quitado de TizenBrew')));
      if (action === 'add' && thenOpen) TizenBrew.launch(m.full, function () {});
    });
  }

  /** YouTube AdFree, Twitch AdFree or another module: open it in TizenBrew. One that is not there yet is added first (with a question);
      TizenTube comes with TizenBrew, so it just opens. When TizenBrew's service is not running yet, the module opens all the same
      (if TizenBrew does not have it, it says so) unless FreeTV knows it never added it. */
  function openBrewApp(full, title) {
    function go() { TizenBrew.launch(full, function (ok) { if (!ok) toast(tr('Não deu para abrir ', "Couldn't open ", 'No se pudo abrir ') + title); }); }
    if (full === 'npm/@foxreis/tizentube') { go(); return; }
    TizenBrew.modules(function (err, have) {
      if (!err && have.indexOf(full) >= 0) { go(); return; }
      var m = null;
      TizenBrew.RECOMMENDED.forEach(function (r) { if (r.full === full) m = r; });
      m = m || {full: full, title: title, about: ''};
      if (!err) { confirmBrewAdd(m, true); return; }
      showDialog(title, [{text: tr(title + ' funciona dentro do TizenBrew e ainda precisa ser adicionado a ele.', title + ' runs inside TizenBrew and still has to be added to it.',
        title + ' funciona dentro de TizenBrew y todavía hay que añadirlo.')}, {cls: 'warn', text: brewClosedText()}],
        [{label: tr('Abrir o TizenBrew', 'Open TizenBrew', 'Abrir TizenBrew'), run: openBrew}, {label: cancelText()}], 0);
    });
  }

  // MARK: - Custom tab: shortcuts to YouTube channels, opened in YouTube AdFree

  function openLocal(p) {
    if (p.local === 'channel') openChannel(p.chan);
    else if (p.local === 'app') launcher(p.app.id, p.title)();
    else if (p.local === 'plus') openAddChannel();
  }

  function openChannel(c) {
    var youtube = youtubeApp();
    if (!youtube) {
      toast(TV.name === 'tizen' ? tr('Instale o YouTube pela loja da Samsung antes', 'Install YouTube from the Samsung store first', 'Instala YouTube desde la tienda de Samsung primero')
        : tr('Instale o YouTube AdFree pela Loja antes', 'Install YouTube AdFree from the Store first', 'Instala YouTube AdFree desde la Tienda primero'));
      return;
    }
    remember('chan:' + c.key, c.title);
    refreshLatest(c);
    // contentTarget: YouTube AdFree adds these parameters to its TV screen (youtube.com/tv). A full youtube.com address would open the
    // desktop website instead. A channel opens its newest video that plays now (with the uploads playlist after it, it did not load); with no
    // video known, just the app.
    var target = c.kind === 'video' ? 'v=' + c.id : c.latest ? 'v=' + c.latest : '';
    TV.launch(youtube, target ? {contentTarget: target} : {}, function (ok) {
      if (!ok) toast(tr('Não deu para abrir ', "Couldn't open ", 'No se pudo abrir ') + c.title);
    });
  }

  /** Hold OK on a shortcut: move it left or right, or take it away. */
  function openChannelMenu(c) {
    var list = channelList(), at = -1, i;
    for (i = 0; i < list.length; i++) if (list[i].key === c.key) at = i;
    var buttons = [{label: tr('Abrir', 'Open', 'Abrir'), run: function () { openChannel(c); }}];
    if (at > 0) buttons.push({label: tr('Mover para a esquerda', 'Move left', 'Mover a la izquierda'), run: function () { moveChannel(c.key, -1); }});
    if (at >= 0 && at < list.length - 1) buttons.push({label: tr('Mover para a direita', 'Move right', 'Mover a la derecha'), run: function () { moveChannel(c.key, 1); }});
    buttons.push({label: tr('Tirar daqui', 'Remove', 'Quitar'), run: function () { removeChannel(c); }});
    var chOn = (Prefs.opt('chanShelf', []) || []).indexOf(c.key) >= 0;
    buttons.push({label: chOn ? tr('Tirar da prateleira', 'Take off the shelf', 'Quitar del estante') : tr('Pôr na prateleira', 'Put on the shelf', 'Añadir al estante'),
      run: function () { toggleShelf('chan:' + c.key, chOn ? 'remove' : 'add', 'chanShelf'); }});
    buttons.push({label: cancelText()});
    showDialog(c.title, [], buttons, 0);
  }

  function moveChannel(key, dx) {
    var keys = channelList().map(function (c) { return c.key; }), at = keys.indexOf(key), to = at + dx;
    if (at < 0 || to < 0 || to >= keys.length) return;
    keys.splice(at, 1);
    keys.splice(to, 0, key);
    Prefs.set('chanOrder', keys);
    st.card = to;
    renderCards();
    updateFocus();
  }

  function removeChannel(c) {
    if (c.added) Prefs.set('chanExtra', Prefs.chanExtra().filter(function (x) { return x.key !== c.key; }));   // added on the TV: gone
    else {
      var hidden = Prefs.chanHidden().slice();   // from the configuration: hidden, and "+" can bring it back
      if (hidden.indexOf(c.key) < 0) hidden.push(c.key);
      Prefs.set('chanHidden', hidden);
    }
    st.card = Math.max(0, Math.min(st.card, channelList().length));
    renderCards();
    updateFocus();
    toast(c.title + ': ' + tr('removido', 'removed', 'quitado'));
  }

  var chanQuery = '';

  /** "+": the name (or @name) typed with the TV's own keyboard, looked up on YouTube by the store service, and one result picked. */
  function openAddChannel() {
    var buttons = [{label: tr('Procurar', 'Search', 'Buscar'), run: function () { searchChannels(chanQuery); }}];
    if (Prefs.chanHidden().length) buttons.push({label: tr('Trazer de volta os removidos', 'Bring back the removed ones', 'Recuperar los quitados'), run: function () {
      Prefs.set('chanHidden', []);
      renderCards();
      updateFocus();
    }});
    buttons.push({label: cancelText()});
    showDialog(tr('Adicionar um canal', 'Add a channel', 'Añadir un canal'), [
      {text: tr('Escreva o nome do canal (ou o seu @nome) com o teclado da TV e aperte Enter.',
          'Type the channel name (or its @name) with the TV keyboard and press Enter.',
          'Escribe el nombre del canal (o su @nombre) con el teclado de la tele y pulsa Intro.')},
      {text: tr('Segure OK sobre um atalho para movê-lo ou tirá-lo daqui.', 'Hold OK on a shortcut to move it or take it away.',
          'Mantén OK sobre un acceso para moverlo o quitarlo.')}
    ], buttons, 0);
    var box = $('dialog').firstChild, input = document.createElement('input');
    input.type = 'text';
    input.className = 'chaninput';
    input.value = chanQuery;
    input.setAttribute('placeholder', tr('Ex.: Bluey', 'E.g. Bluey', 'Ej.: Bluey'));
    input.oninput = function () { chanQuery = input.value; };
    input.onEnter = function (v) { chanQuery = v; searchChannels(v); };
    box.insertBefore(input, box.querySelector('.row'));
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 250);   // the TV opens its keyboard
  }

  function searchChannels(q) {
    q = String(q || '').replace(/^\s+|\s+$/g, '');
    if (!q) { openAddChannel(); return; }
    if (TV.name !== 'webos') { toast(tr('Só na TV LG', 'Only on the LG TV', 'Solo en la tele LG')); return; }
    var title = tr('Adicionar um canal', 'Add a channel', 'Añadir un canal');
    var token = showDialog(title, [{text: tr('Procurando «' + q + '» no YouTube…', 'Looking for «' + q + '» on YouTube…', 'Buscando «' + q + '» en YouTube…')}], [], 0);
    svcCall('channels', {query: q}, function (r) {
      if (dlg.token !== token || st.zone !== Z.DLG) return;   // closed meanwhile
      if (!r || !r.returnValue || !r.channels || !r.channels.length) {
        showDialog(title, [{cls: 'warn', text: (r && r.error) || tr('A TV não respondeu.', 'The TV did not answer.', 'La tele no respondió.')}],
          [{label: tr('Procurar outro', 'Search again', 'Buscar otro'), run: openAddChannel}, {label: cancelText()}], 0);
        return;
      }
      var buttons = r.channels.map(function (c) {
        return {label: c.title + (c.subs ? '  ·  ' + c.subs : ''), run: function () { addChannel(c); }};
      });
      buttons.push({label: tr('Procurar outro', 'Search again', 'Buscar otro'), run: openAddChannel});
      buttons.push({label: cancelText()});
      showDialog(tr('Escolha o canal', 'Pick the channel', 'Elige el canal'), [], buttons, 0);
    });
  }

  function addChannel(c) {
    var all = allChannels(), i;
    for (i = 0; i < all.length; i++) {
      if (all[i].id === c.id) {   // already there (maybe taken away): show it again
        Prefs.set('chanHidden', Prefs.chanHidden().filter(function (k) { return k !== all[i].key; }));
        renderCards();
        updateFocus();
        toast(all[i].title + ': ' + tr('já está', 'already there', 'ya está'));
        return;
      }
    }
    var extra = Prefs.chanExtra().slice();
    extra.push({key: 'yt-' + c.id.slice(2).toLowerCase(), title: String(c.title || '').slice(0, 40), kind: 'channel', id: c.id,
                thumb: /^https:\/\//.test(c.thumb || '') ? c.thumb : '', latest: c.latest || '', added: true});
    Prefs.set('chanExtra', extra);
    renderCards();
    updateFocus();
    toast(c.title + ': ' + tr('adicionado', 'added', 'añadido'));
  }

  /** A channel added on the TV keeps its newest video up to date for the next time it is opened. */
  function refreshLatest(c) {
    if (!c.added) return;
    svcCall('channels', {query: c.id}, function (r) {
      var v = r && r.returnValue && r.channels && r.channels[0] && r.channels[0].latest;
      if (!v || v === c.latest) return;
      Prefs.set('chanExtra', Prefs.chanExtra().map(function (x) { if (x.key === c.key) x.latest = v; return x; }));
    });
  }

  /** Hold OK on something in Continue watching: open it, or take it off the list. */
  function openRecentMenu(p) {
    showDialog(p.title, [], [
      {label: tr('Abrir', 'Open', 'Abrir'), run: function () { openLocal(p); }},
      {label: tr('Tirar de Continuar assistindo', 'Remove from Continue watching', 'Quitar de Continuar viendo'), run: function () {
        Prefs.set('recent', Prefs.recent().filter(function (x) { return x.id !== p.id; }));
        st.card = Math.max(0, st.card - 1);
        renderCards();
        updateFocus();
      }},
      {label: cancelText()}
    ], 0);
  }

  /** What holding OK opens where the focus is (null: OK only acts when it is pressed). */
  function holdMenu() {
    if (Prefs.kids()) return null;
    if (st.zone === Z.TOP && st.top < TABS) { var tab = VIS[st.top]; return function () { openTabMenu(tab); }; }
    var p = st.zone === Z.CARDS ? cards[st.card] : null;
    if (p && st.tab === 0 && p.local === 'channel') return function () { openChannelMenu(p.chan); };
    if (p && st.tab === 1 && (p.local === 'channel' || p.local === 'app')) return function () { openRecentMenu(p); };
    if (st.zone === Z.APPS && others[st.grid] && TV.name === 'webos') { var app = others[st.grid]; return function () { openAppMenu(app); }; }
    return null;
  }

  // MARK: - All Apps: holding OK opens a small menu (open, or uninstall with a question first)

  var PROTECTED = /^(com\.gathin\.|com\.local\.nativehome$|freetv\.store$)/;

  function openAppMenu(app) {
    var buttons = [{label: tr('Abrir', 'Open', 'Abrir'), run: launcher(app.id, app.title)}];
    var onShelf = shelf.some(function (x) { return x.id === app.id; });
    buttons.push({label: onShelf ? tr('Tirar da prateleira', 'Take off the shelf', 'Quitar del estante') : tr('Pôr na prateleira', 'Put on the shelf', 'Añadir al estante'),
      run: function () { toggleShelf(app.id, onShelf ? 'remove' : 'add'); }});
    buttons.push({label: quickApps().indexOf(app.id) >= 0 ? tr('Tirar do painel rápido', 'Take off the quick panel', 'Quitar del panel rápido') : tr('Pôr no painel rápido', 'Put in the quick panel', 'Añadir al panel rápido'),
      run: function () { toggleQuickApp(app); }});
    if (!PROTECTED.test(app.id)) buttons.push({label: tr('Desinstalar', 'Uninstall', 'Desinstalar'), run: function () { confirmRemove(app); }});
    buttons.push({label: tr('Ocultar daqui', 'Hide from here', 'Ocultar de aquí'), run: function () {
      Prefs.set('hiddenApps', Prefs.hiddenApps().concat([app.id]));
      pickShelf();
      renderApps();
      st.grid = Math.max(0, Math.min(st.grid, others.length - 1));
      updateFocus();
      toast(app.title + ': ' + tr('oculta (Ajustes → Apps ocultas)', 'hidden (Settings → Hidden apps)', 'oculta (Ajustes → Apps ocultas)'));
    }});
    buttons.push({label: cancelText()});
    showDialog(app.title, [], buttons, 0);
  }

  function confirmRemove(app) {
    showDialog(tr('Desinstalar?', 'Uninstall?', '¿Desinstalar?'), [
      {text: tr('Tem certeza de que quer apagar «' + app.title + '»?', 'Are you sure you want to delete «' + app.title + '»?', '¿Seguro que quieres borrar «' + app.title + '»?')}
    ], [{label: cancelText()}, {label: tr('Sim, apagar', 'Yes, delete', 'Sí, borrar'), run: function () { removeApp(app); }}], 0);
  }

  function removeApp(app) {
    var token = showDialog(app.title, [{text: tr('Apagando…', 'Deleting…', 'Borrando…')}], [], 0);
    function result(title, text) {
      if (dlg.token === token && st.zone === Z.DLG) showDialog(title, [{text: text, cls: 'warn'}], [{label: 'OK'}], 0);
      else toast(text);
    }
    svcCall('remove', {id: app.id}, function (r) {
      if (r && r.returnValue) {
        toast(app.title + ': ' + tr('apagada', 'deleted', 'borrada'));
        svcApps(function () {
          loadApps(function () {
            renderShelf(); renderDrawer();
            if (st.zone === Z.APPS || (st.zone === Z.DLG && dlg.from === Z.APPS)) { renderApps(); st.grid = Math.max(0, Math.min(st.grid, others.length - 1)); }
            if (dlg.token === token && st.zone === Z.DLG) closeDialog(); else updateFocus();
          });
        });
        return;
      }
      var why = r && r.error ? r.error : '';
      var text = !r ? tr('FreeTV precisa do acesso da Loja para apagar apps (o install.sh pergunta por ele).',
              'FreeTV needs the Store permission to delete apps (install.sh asks about it).', 'FreeTV necesita el permiso de la Tienda para borrar apps (install.sh lo pregunta).')
          : r.code === 'not-removable' ? tr('A LG não deixa apagar esta app por aqui (só as instaladas pelo Modo Desenvolvedor, como as da Loja). Na tela inicial da LG, segure OK sobre ela e escolha Remover.',
              'LG does not let this app be deleted from here (only those installed through Developer Mode, like the Store ones). On LG\'s home, hold OK on it and choose Delete.',
              'LG no deja borrar esta app desde aquí (solo las instaladas con el Modo Desarrollador, como las de la Tienda). En el inicio de LG, mantén OK sobre ella y elige Eliminar.')
          : tr('Não foi possível apagar: ', 'Could not delete: ', 'No se pudo borrar: ') + why;
      result(app.title, text);
    });
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
        if (st.top < TABS) return;
        if (st.top === TABS) { var live = liveTV(); if (live) launcher(live.id, tr('TV aberta', 'Live TV', 'TV en vivo'))(); }
        else if (st.top === TABS + 1) { st.zone = Z.SHELF; openDrawer(); st.drawer = 1 < drawerInputs ? 1 : 0; updateFocus(); }
        else openSettings();
        return;
      case Z.CARDS:
        var p = cards[st.card];
        if (p && p.local) { openLocal(p); return; }
        var app = p && Data.appFor(p.app);
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
        if (others[st.grid]) {
          launcher(others[st.grid].id, others[st.grid].title)();   // holding OK opens the menu (open, uninstall)
        }
        return;
      case Z.DLG:
        if (dlg.acts[dlg.index]) { var run = dlg.acts[dlg.index]; closeDialog(); run(); }
        return;
      case Z.SETTINGS:
        if (rowsNow[st.row]) { rowsNow[st.row].step(1); if (st.zone === Z.SETTINGS) renderSettings(); }
        return;
      case Z.EDIT:
        editShelf(0);
        return;
      case Z.TILES:
        if (tileSheet.defs[st.tile] && tileSheet.defs[st.tile].run) {
          tileSheet.defs[st.tile].run();
          if (st.zone === Z.TILES) { tileSheet.defs = tileDefs(); renderTiles(); }
        }
        return;
      case Z.COMM:
        if (commOpen < 0 && commList[st.comm] && commList[st.comm].ctl) commCtl(commList[st.comm], 1);
        else if (commOpen < 0 && commList[st.comm]) { commOpen = st.comm; commAct = 0; renderCommunity(); }
        else if (commOpen >= 0 && commActs[commAct]) commActs[commAct]();
        return;
      case Z.SUGG:
        if (suggestNow[st.sug]) { var sr = suggestNow[st.sug]; sr.step(1); if (st.zone === Z.SUGG) renderSuggest(); }
        return;
      case Z.INFO:
        infoActivate();
        return;
    }
  }

  function selectTab(i) {
    if (i === st.tab) return;
    st.tab = i;
    if (Prefs.startTab() === 'last') Prefs.set('lastTab', i);
    renderCards();
  }

  function move(dx, dy) {
    var tiles = $('tiles').children, cardNodes = $('cards').children;
    switch (st.zone) {
      case Z.SHELF:
        if (grabbed >= 0) { if (dx) shift(dx); return; }   // a picked-up app only moves sideways
        if (dx) st.shelf = Math.max(0, Math.min(shelf.length - 1, st.shelf + dx));
        else if (dy > 0) { if (Prefs.kids()) { kidsExit(); return; } openDrawer(); return; }
        else if (dy < 0) {
          if (cards.length) { st.zone = Z.CARDS; st.card = nearest(cardNodes, centerX(tiles[st.shelf])); }
          else { st.zone = Z.TOP; st.top = Math.max(0, VIS.indexOf(st.tab)); }
        }
        break;
      case Z.CARDS:
        if (dx) st.card = Math.max(0, Math.min(cards.length - 1, st.card + dx));
        else if (dy < 0) { st.zone = Z.TOP; st.top = Math.max(0, VIS.indexOf(st.tab)); }
        else if (shelf.length) { st.zone = Z.SHELF; st.shelf = nearest(tiles, centerX(cardNodes[st.card])); }
        break;
      case Z.TOP:
        if (dx) {
          st.top = Math.max(0, Math.min(Prefs.kids() ? TABS - 1 : TABS + 2, st.top + dx));
          if (st.top < TABS) selectTab(VIS[st.top]);   // as on Apple TV: focusing a tab selects it
        } else if (dy > 0) {
          if (cards.length) { st.zone = Z.CARDS; st.card = Math.min(cards.length - 1, st.top < TABS ? 0 : cards.length - 1); }
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
      case Z.TILES:
        if (dx) st.tile = Math.max(0, Math.min(tileSheet.defs.length - 1, st.tile + dx));
        else if (dy) { var tc = tileCols(tileSheet.defs.length); if (st.tile + dy * tc >= 0 && st.tile + dy * tc < tileSheet.defs.length) st.tile += dy * tc; }
        break;
      case Z.COMM:
        if (commOpen < 0 && dy) st.comm = Math.max(0, Math.min(commList.length - 1, st.comm + dy));
        else if (commOpen < 0 && dx && commList[st.comm] && commList[st.comm].ctl > 1) { commCtl(commList[st.comm], dx); return; }
        else if (commOpen >= 0 && dy) commAct = Math.max(0, Math.min(commActs.length - 1, commAct + dy));
        break;
      case Z.DLG:
        if (dy) dlg.index = Math.max(0, Math.min(dlg.acts.length - 1, dlg.index + dy));
        break;
      case Z.INFO:
        infoMove(dx, dy);
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
    if (st.zone === Z.DLG) { closeDialog(); return; }
    if (st.zone === Z.INFO) { if (info.back) info.back(); else closeSheets(); return; }
    if (st.zone === Z.EDIT) {
      setClass($('shelfedit'), 'open', false);
      openSettings();
      for (var e = 0; e < rowsNow.length; e++) if (rowsNow[e].label === tr('Prateleira', 'Shelf', 'Estante')) st.row = e;
      updateFocus();
      return;
    }
    if (st.zone === Z.COMM) {
      if (commOpen >= 0) {
        if (store.flow !== 'working') store.flow = 'idle';   // a running install carries on in the background
        if (store.flowAll !== 'working') { store.flowAll = 'idle'; applyUpdateRow(); }
        commOpen = -1;
        renderCommunity();
        return;
      }
      setClass($('community'), 'open', false);
      commMarkSeen();
      if (commFromShelf) { commFromShelf = false; st.zone = Z.SHELF; updateFocus(); return; }   // opened from its icon: back to the shelf
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
    if (st.zone === Z.SETTINGS && settingsCat) { settingsCat = null; st.row = settingsCatRow; renderSettings(); return; }
    if (sheetOpen()) { closeSheets(); return; }
    if (st.zone === Z.DRAWER) { closeDrawer(); return; }
    if (Prefs.kids()) { kidsExit(); return; }
    if (st.zone !== Z.SHELF && shelf.length) { st.zone = Z.SHELF; updateFocus(); return; }
    TV.back();
  }

  /** The pointer focuses what it's over (the Magic Remote, or a mouse when previewing). */
  var pressTimer = 0, pressHeld = false;

  function hover(node, zone, index) {
    node.onmouseover = function () {
      if (st.zone === Z.DLG) return;
      if (saverOn || (sheetOpen() !== (zone === Z.APPS || zone === Z.SETTINGS || zone === Z.EDIT || zone === Z.SUGG || zone === Z.COMM || zone === Z.TILES || zone === Z.INFO))) return;
      if (zone === Z.DRAWER && st.zone !== Z.DRAWER) return;
      if (zone !== Z.DRAWER && st.zone === Z.DRAWER && zone !== Z.SHELF) return;
      if (zone === Z.SHELF && st.zone === Z.DRAWER) closeDrawer();
      st.zone = zone;
      if (zone === Z.TOP) { st.top = index; if (index < TABS) selectTab(VIS[index]); }
      else if (zone === Z.CARDS) st.card = index;
      else if (zone === Z.SHELF) st.shelf = index;
      else if (zone === Z.DRAWER) st.drawer = index;
      else if (zone === Z.APPS) st.grid = index;
      else if (zone === Z.SETTINGS) st.row = index;
      else if (zone === Z.EDIT) st.edit = index;
      else if (zone === Z.SUGG) st.sug = index;
      else if (zone === Z.COMM) st.comm = index;
      else if (zone === Z.TILES) st.tile = index;
      else if (zone === Z.INFO) info.index = index;
      updateFocus();
    };
    // The Magic Remote's wheel, with the pointer on screen, clicks instead of sending OK: holding it on the shelf picks the app up,
    // and on a channel, in Continue watching or in All Apps it opens the menu, like holding OK.
    node.onmousedown = function () {
      if (st.zone === Z.DLG) return;
      node.onmouseover();
      pressHeld = false;
      clearTimeout(pressTimer);
      if (st.zone === Z.SHELF || holdMenu()) pressTimer = setTimeout(function () {
        pressHeld = true;
        if (st.zone === Z.SHELF) grab(st.shelf);
        else { var open = holdMenu(); if (open) open(); }
      }, OK_HOLD);
    };
    node.onmouseup = node.onmouseleave = function () { clearTimeout(pressTimer); };
    node.onclick = function () {
      if (st.zone === Z.DLG) return;
      if (pressHeld) { pressHeld = false; return; }   // the hold already did its part
      node.onmouseover();
      activate();
    };
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

  var saverOn = false, idleAt = Date.now(), saverIndex = 0, saverSeq = 0, saverTimer = 0, SAVER_AFTER = 2 * 60000;

  // Photos from the web for the screensaver: {web, title, credit}. Fetched once a day (Immich: every hour), kept between starts.
  function saverWeb(mode, done) {
    var key = 'saver.' + mode, have = cache(key);
    if (have && have.items && have.items.length && Date.now() - have.at < (mode === 'immich' ? 3600000 : 864e5)) { done(have.items); return; }
    function keep(items) { if (items.length) cache(key, {at: Date.now(), items: items}); done(items); }
    if (mode === 'potd') {
      var out = [], left = 10;
      for (var i = 0; i < 10; i++) (function (d) {
        var day = d.getFullYear() + '/' + pad2(d.getMonth() + 1) + '/' + pad2(d.getDate());
        Data.getJson('https://api.wikimedia.org/feed/v1/wikipedia/en/featured/' + day, function (err, f) {
          var im = f && f.image;
          if (!err && im && im.title) {
            out.push({web: 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(im.title.replace(/^File:/, '')) + '?width=1920',
              title: im.description && im.description.text ? im.description.text.replace(/<[^>]+>/g, '').slice(0, 90) : tr('Foto do dia', 'Picture of the day', 'Foto del día'),
              credit: '© ' + (im.artist && im.artist.text ? im.artist.text.replace(/<[^>]+>/g, '').slice(0, 60) : 'Wikimedia') + (im.license && im.license.type ? ' · ' + im.license.type : '') + ' · Wikimedia Commons'});
          }
          if (--left === 0) keep(out);
        });
      })(new Date(Date.now() - i * 864e5));
    } else if (mode === 'apod') {
      Data.getJson('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&count=12&thumbs=true', function (err, list) {
        keep(!err && list instanceof Array ? list.filter(function (x) { return x.media_type === 'image' && x.url; }).map(function (x) {
          return {web: x.url, title: x.title, credit: '© ' + (x.copyright ? trim(x.copyright) : 'NASA') + ' · APOD'};
        }) : []);
      });
    } else if (mode === 'immich') {
      var m = /^(https:\/\/[^\/]+)\/share\/([\w-]+)/.exec(Prefs.opt('immichUrl', '') || '');
      if (!m) { done([]); return; }
      var api = m[1] + '/api/shared-links/me?key=' + m[2];
      var got = function (text) {
        var j = null;
        try { j = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) {}
        var assets = j && j.assets ? j.assets.filter(function (a) { return a.type === 'IMAGE'; }) : [];
        keep(assets.slice(0, 200).map(function (a) {
          return {web: m[1] + '/api/assets/' + a.id + '/thumbnail?size=preview&key=' + m[2], title: j.album && j.album.albumName ? j.album.albumName : 'Immich', credit: a.originalFileName || ''};
        }));
      };
      Data.getJson(api, function (err, j) {
        if (!err && j) { got(j); return; }
        if (TV.name === 'webos') svcCall('feed', {url: api}, function (r) { got(r && r.returnValue ? r.text : null); });   // a server without CORS
        else done([]);
      });
    } else done([]);
  }

  var screenOffTimer = 0, screenIsOff = false;

  function showSaver() {
    var mode = Data.saver(), photos = /^(places|potd|apod|immich|clock)$/.test(mode) ? [] : Data.showcase().filter(function (p) { return p.backdrop && Data.appFor(p.app); });
    if (/^(potd|apod|immich)$/.test(mode)) {
      saverWeb(mode, function (items) {
        for (var w = items.length - 1; w > 0; w--) { var r = Math.floor(Math.random() * (w + 1)), x = items[w]; items[w] = items[r]; items[r] = x; }
        items.forEach(function (it) { photos.push(it); });
        if (!items.length) landscapes().forEach(function (p) { photos.push({place: p}); });   // nothing came: the landscapes
      });
    }
    if ((mode === 'both' || mode === 'places') && typeof LANDSCAPES !== 'undefined') {
      // Photos of the places (Wikimedia Commons, free licences) go in a random order, one after every pick when both are on.
      var places = landscapes(), mixed = [], j, k, t;
      for (j = places.length - 1; j > 0; j--) { k = Math.floor(Math.random() * (j + 1)); t = places[j]; places[j] = places[k]; places[k] = t; }
      for (j = 0; j < Math.max(places.length, photos.length); j++) {
        if (j < places.length) mixed.push({place: places[j]});
        if (j < photos.length) mixed.push(photos[j]);
      }
      photos = mixed;
    }
    saverOn = true;
    var s = $('saver');
    s.innerHTML = '';
    var a = el('div', 'photo', s), b = el('div', 'photo', s);
    el('div', 'shade', s);
    var clock = el('div', 'clock', s);
    if (Prefs.opt('saverClock', true) === false && mode !== 'clock') clock.style.visibility = 'hidden';
    setClass(s, 'bigclock', mode === 'clock');
    setClass(s, 'dim', Prefs.opt('saverDim', true) !== false && Data.isNight(Date.now()));
    el('div', 'time', clock);
    el('div', 'date', clock);
    var wx = Data.weather;
    if (wx && Prefs.opt('saverWeather', true) !== false) {
      var wl = el('div', 'wx', clock);
      sym(Data.symbol(wx.code, wx.isDay), wl);
      wl.appendChild(document.createTextNode(Data.degrees(wx.temp) + '  ' + Data.condition(wx.code, wx.isDay)));
    }
    el('div', 'title', clock);
    var credit = el('div', 'credit', s);
    tickSaverClock(clock);   // the clock is there at once, even while the first photo is still coming
    var front = a;
    function next() {
      if (!saverOn) return;
      var p = photos.length ? photos[saverIndex++ % photos.length] : null;
      var back = front === a ? b : a;
      if (p && (p.place || p.web)) {
        // A photo from the web is fetched first and shown when it is ready (a slow one never leaves a black screen); one that
        // fails or takes too long is skipped.
        var im = new Image(), mine = ++saverSeq, settled = false;
        var go = function (ok) {
          if (settled || !saverOn || mine !== saverSeq) return;
          settled = true;
          if (!ok) { saverTimer = setTimeout(next, 1000); return; }
          back.style.backgroundImage = 'url(' + im.src + ')';
          back.style.webkitTransform = back.style.transform = 'scale(1.0)';
          clock.lastChild.textContent = p.web ? p.title : p.place[1];
          credit.textContent = p.web ? p.credit : '© ' + p.place[2] + ' · ' + p.place[3] + ' · Wikimedia Commons';   // as CC BY asks
          setTimeout(function () {
            setClass(back, 'on', true);
            setClass(front, 'on', false);
            back.style.webkitTransform = back.style.transform = 'scale(1.08) translateX(-1.5%)';
            front = back;
          }, 60);
          tickSaverClock(clock);
          saverTimer = setTimeout(next, 12000);
        };
        im.onload = function () { go(true); };
        im.onerror = function () { go(false); };
        setTimeout(function () { go(false); }, 40000);
        im.src = p.web || 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(p.place[0]) + '?width=1920';
        return;
      } else if (p) {
        credit.textContent = '';
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
    TV.holdScreen(true);   // LG's own screensaver would go over ours
    next();
    // An OLED rests better dark: after a while the screen goes off (the sound stays); any key turns it on again.
    clearTimeout(screenOffTimer);
    var offAfter = +Prefs.opt('screenOff', 0);
    if (offAfter && TV.name === 'webos') screenOffTimer = setTimeout(function () {
      if (!saverOn) return;
      TV.screenOff(function (ok) { screenIsOff = ok; });
    }, offAfter * 60000);
  }

  function tickSaverClock(clock) {
    var d = new Date();
    if (hasClass($('saver'), 'bigclock')) {   // the big clock moves a little every minute, so nothing stays in one place on an OLED
      var dx = Math.round(Math.random() * 240 - 120), dy = Math.round(Math.random() * 160 - 80);
      clock.style.webkitTransform = clock.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
    }
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
    clearTimeout(screenOffTimer);
    if (screenIsOff) { screenIsOff = false; TV.screenOn(); }
    if (document.hidden) TV.holdScreen(false);   // on screen, the watcher stays (watchLgSaver)
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

  // MARK: - 2.1: info sheets. A wide glass box for the weather, the markets, my widgets, the time of use, the profiles…: something
  // to look at on top, and rows below that work like Home Settings (OK or the arrows).

  var info = {kind: '', arg: null, rows: [], index: 0, back: null};
  var INFO = {};   // kind → function (arg): {title, icon, build(box), rows, hint, visible, back}

  function openInfo(kind, arg) {
    ['settings', 'tilesheet', 'community', 'dialog'].forEach(function (id) { setClass($(id), 'open', false); });
    setClass(body, 'drawer-open', false);
    info.kind = kind;
    info.arg = arg;
    info.index = 0;
    st.zone = Z.INFO;
    renderInfo();
    setClass($('infosheet'), 'open', true);
    updateFocus();
  }

  function renderInfo() {
    if (!INFO[info.kind]) return;
    var box = $('infosheet').firstChild, def = INFO[info.kind](info.arg);
    box.innerHTML = '';
    var title = el('div', 'title', box);
    sym(def.icon || 'sparkles', title);
    title.appendChild(document.createTextNode(def.title));
    if (def.build) def.build(box);
    info.rows = def.rows || [];
    info.back = def.back || null;
    if (info.rows.length) {
      var vis = def.visible || 5, list = el('div', 'list', box), holder = el('div', 'rows', list);
      holder.setAttribute('data-visible', vis);
      list.style.height = Math.min(info.rows.length, vis) * 78 + 'px';
      for (var i = 0; i < info.rows.length; i++) drawRow(info.rows[i], holder, Z.INFO, i);
    }
    el('div', 'hint', box, def.hint || (info.rows.length ? tr('OK ou as setas · Voltar fecha', 'OK or the arrows · Back closes', 'OK o las flechas · Atrás cierra')
        : tr('Voltar fecha', 'Back closes', 'Atrás cierra')));
    info.index = Math.max(0, Math.min(info.index, info.rows.length - 1));
    updateFocus();
  }

  /** A row like Home Settings' ones: a switch, a value with ‹ ›, a › that opens something, or a plain value (plain: true). */
  function drawRow(r, holder, zone, i) {
    var row = el('div', 'row' + (r.dim ? ' dim' : '') + (r.icon ? ' hasico' : ''), holder, r.label);
    if (r.icon) sym(r.icon, row).className += ' ico';
    if (r.toggle !== undefined) setClass(el('div', 'toggle', row), 'on', r.toggle);
    else if (r.value !== undefined) {
      var v = el('span', 'value', row);
      if (r.value === '›' || r.plain) v.textContent = r.value;
      else { el('span', 'chev', v, '‹'); v.appendChild(document.createTextNode(r.value)); el('span', 'chev', v, '›'); }
    }
    if (r.spark && r.spark.sym) sparkIn(row, r.spark);
    hover(row, zone, i);
    return row;
  }

  /** A quote's last 24 hours as a small line, inside its row. */
  function sparkIn(row, q) {
    var c = el('canvas', 'spark', row), d = quoteData[q.kind + ':' + q.sym];
    c.width = 200;
    c.height = 48;
    if (d) chart(c, d.spark, {line: 2.5, pad: 3, fill: false});
    else fetchQuote(q.kind, q.sym, function (d2) { if (d2) chart(c, d2.spark, {line: 2.5, pad: 3, fill: false}); });
  }

  function infoMove(dx, dy) {
    var r = info.rows[info.index];
    if (dy) info.index = Math.max(0, Math.min(info.rows.length - 1, info.index + dy));
    else if (dx && r && r.move) { r.move(dx); if (st.zone === Z.INFO) renderInfo(); }
    else if (dx && r && r.step && r.value !== '›' && !r.plain && r.toggle === undefined) { r.step(dx); if (st.zone === Z.INFO) renderInfo(); }
  }

  function infoActivate() {
    var r = info.rows[info.index];
    if (!r) return;
    if (r.run) r.run();
    else if (r.step) r.step(1);
    if (st.zone === Z.INFO) renderInfo();
  }

  /** A line of text typed with the TV's keyboard (a name, a symbol, an address…); done(text) when Enter or Save is pressed. */
  function askText(title, text, value, done, placeholder) {
    showDialog.icon = 'search';
    var input = document.createElement('input');
    showDialog(title, [{text: text}], [{label: tr('Guardar', 'Save', 'Guardar'), run: function () { done(input.value); }}, {label: cancelText()}], 0);
    var box = $('dialog').firstChild;
    input.type = 'text';
    input.className = 'chaninput';
    input.value = value || '';
    if (placeholder) input.setAttribute('placeholder', placeholder);
    input.onEnter = function (v) { closeDialog(); done(v); };
    box.insertBefore(input, box.querySelector('.row'));
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 250);
  }

  function trim(s) { return String(s === undefined || s === null ? '' : s).replace(/^\s+|\s+$/g, ''); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function hhmm(d) { d = d || new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function parseTime(s) { var m = /^\s*(\d{1,2})[:.h ]?(\d{2})?\s*$/.exec(s || ''); if (!m || +m[1] > 23 || +(m[2] || 0) > 59) return ''; return pad2(+m[1]) + ':' + pad2(+(m[2] || 0)); }
  function plural(n, one, many) { return n === 1 ? one : many; }
  function dur(ms) {
    var m = Math.round(ms / 60000), h = Math.floor(m / 60);
    return h ? h + ' h ' + pad2(m % 60) + ' min' : m + ' min';
  }
  function weekday(d, long) {
    try { return d.toLocaleDateString(I18N.locale(), {weekday: long ? 'long' : 'short'}); } catch (e) { return d.toDateString().slice(0, 3); }
  }
  function cache(key, value) {
    if (value === undefined) { try { return JSON.parse(localStorage.getItem('fmtv.c.' + key)); } catch (e) { return null; } }
    try { localStorage.setItem('fmtv.c.' + key, JSON.stringify(value)); } catch (e) {}
    return value;
  }

  /** A small line chart in a canvas: values left to right, green when it ended up, red when down. */
  function chart(canvas, values, opts) {
    opts = opts || {};
    var c = canvas.getContext('2d'), w = canvas.width, h = canvas.height, v = values.filter(function (x) { return typeof x === 'number' && !isNaN(x); });
    c.clearRect(0, 0, w, h);
    if (v.length < 2) return;
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), span = hi - lo || 1, up = v[v.length - 1] >= v[0], pad = opts.pad || 4;
    var col = up ? '63, 214, 155' : '255, 107, 107';
    c.beginPath();
    for (var i = 0; i < v.length; i++) {
      var x = pad + (w - 2 * pad) * i / (v.length - 1), y = pad + (h - 2 * pad) * (1 - (v[i] - lo) / span);
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.lineWidth = opts.line || 3;
    c.lineJoin = 'round';
    c.strokeStyle = 'rgb(' + col + ')';
    c.stroke();
    if (opts.fill !== false) {
      c.lineTo(w - pad, h);
      c.lineTo(pad, h);
      c.closePath();
      var g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(' + col + ', 0.32)');
      g.addColorStop(1, 'rgba(' + col + ', 0)');
      c.fillStyle = g;
      c.fill();
    }
  }

  // MARK: - 2.1: the remote's number and colour keys

  var KEY_ACTIONS = ['quick', 'search', 'weather', 'markets', 'widgets', 'saver', 'apps', 'settings', 'store', 'profile', 'tvset', 'live', 'none'];

  function keyActionName(a) {
    return {quick: tr('Painel rápido', 'Quick panel', 'Panel rápido'), search: tr('Procurar', 'Search', 'Buscar'), weather: tr('Clima', 'Weather', 'El tiempo'),
      markets: tr('Mercados', 'Markets', 'Mercados'), widgets: tr('Meus widgets', 'My widgets', 'Mis widgets'), saver: tr('Protetor de tela', 'Screensaver', 'Salvapantallas'),
      apps: tr('Todos os Apps', 'All Apps', 'Todas las apps'), settings: tr('Ajustes do Início', 'Home Settings', 'Ajustes de inicio'), store: tr('Loja', 'Store', 'Tienda'),
      profile: tr('Trocar de perfil', 'Switch profile', 'Cambiar de perfil'), tvset: tr('Ajustes da TV', 'TV Settings', 'Ajustes del TV'),
      live: tr('TV em direto', 'Live TV', 'TV en directo'), none: tr('Nada', 'Nothing', 'Nada')}[a] || a;
  }

  var KEY_COLORS = {403: ['keyRed', 'quick'], 404: ['keyGreen', 'search'], 405: ['keyYellow', 'weather'], 406: ['keyBlue', 'widgets']};

  function runAction(a) {
    if (a === 'none') return;
    if (a !== 'saver') closeSheets();
    if (a === 'quick') openTiles('quick');
    else if (a === 'search') openSearch();
    else if (a === 'weather') openInfo('weather');
    else if (a === 'markets') openInfo('markets');
    else if (a === 'widgets') openInfo('widgets');
    else if (a === 'saver') { closeSheets(); setTimeout(showSaver, 200); }
    else if (a === 'apps') openApps();
    else if (a === 'settings') openSettings();
    else if (a === 'store') { if (TV.name === 'webos') openCommunity(true); else openModules(); }
    else if (a === 'profile') nextProfile();
    else if (a === 'tvset') tvSettings();
    else if (a === 'live') { var live = liveTV(); if (live) launcher(live.id, tr('TV aberta', 'Live TV', 'TV en vivo'))(); }
  }

  /** A number or colour key on the home screen: 1-9 open the shelf's apps, 0 All Apps; each colour does what Home Settings says. */
  function shortcutKey(k) {
    if (Prefs.kids() || st.zone === Z.DLG || pin.on) return false;
    if (k >= 48 && k <= 57 && Prefs.opt('numKeys', true) !== false && !sheetOpen()) {
      if (k === 48) { openApps(); return true; }
      var app = shelf[k - 49];
      if (app) { st.zone = Z.SHELF; st.shelf = k - 49; updateFocus(); launcher(app.id, app.title)(); }
      return true;
    }
    var c = KEY_COLORS[k];
    if (!c) return false;
    runAction(Prefs.opt(c[0], c[1]));
    return true;
  }

  // MARK: - 2.1: the weather, in full

  function uvText(uv) {
    if (uv === null || uv === undefined || isNaN(uv)) return '—';
    var n = Math.round(uv);
    return n + ' · ' + (n <= 2 ? tr('baixo', 'low', 'bajo') : n <= 5 ? tr('moderado', 'moderate', 'moderado') : n <= 7 ? tr('alto', 'high', 'alto')
        : n <= 10 ? tr('muito alto', 'very high', 'muy alto') : tr('extremo', 'extreme', 'extremo'));
  }

  function airText(a) {
    if (!a || a.aqi === null || a.aqi === undefined) return '—';
    var v = Math.round(a.aqi), t;
    if (a.us) t = v <= 50 ? tr('boa', 'good', 'buena') : v <= 100 ? tr('aceitável', 'moderate', 'aceptable') : v <= 150 ? tr('ruim para sensíveis', 'unhealthy for some', 'mala para sensibles') : tr('ruim', 'unhealthy', 'mala');
    else t = v <= 20 ? tr('boa', 'good', 'buena') : v <= 40 ? tr('razoável', 'fair', 'razonable') : v <= 60 ? tr('moderada', 'moderate', 'moderada') : v <= 80 ? tr('ruim', 'poor', 'mala') : tr('muito ruim', 'very poor', 'muy mala');
    return v + ' · ' + t;
  }

  function rainText(w) {
    if (w.rainSoon === undefined) return '—';
    if (w.rainAt) {
      var mins = Math.max(0, Math.round((w.rainAt - Date.now()) / 60000));
      return mins < 5 ? tr('Chovendo agora', 'Raining now', 'Lloviendo ahora') : tr('Chuva em ' + mins + ' min', 'Rain in ' + mins + ' min', 'Lluvia en ' + mins + ' min');
    }
    return tr('Sem chuva na próxima hora', 'No rain in the next hour', 'Sin lluvia la próxima hora');
  }

  INFO.weather = function () {
    var w = Data.weather;
    return {title: Data.city || tr('Clima', 'Weather', 'El tiempo'), icon: w ? Data.symbol(w.code, w.isDay) : 'cloud', build: function (box) {
      setClass(box, 'wide', true);
      if (!w) { line(box, '', tr('Sem dados do clima agora.', 'No weather data right now.', 'No hay datos del clima ahora.')); return; }
      var top = el('div', 'wxtop', box), now = el('div', 'wxnow', top);
      sym(Data.symbol(w.code, w.isDay), now);
      el('span', 'temp', now, Data.degrees(w.temp));
      var side = el('div', 'wxside', top);
      el('div', 'big', side, Data.condition(w.code, w.isDay));
      el('div', '', side, tr('Sensação ', 'Feels like ', 'Sensación ') + Data.degrees(w.feels) + '   ·   ' + tr('Máx. ', 'H ', 'Máx. ') + Data.degrees(w.max) + '  ' + tr('Mín. ', 'L ', 'Mín. ') + Data.degrees(w.min));
      el('div', 'rain', side, rainText(w));
      var facts = el('div', 'wxfacts', box);
      [[tr('Umidade', 'Humidity', 'Humedad'), w.humidity === undefined ? '—' : Math.round(w.humidity) + '%'],
       [tr('Vento', 'Wind', 'Viento'), Data.wind(w.wind)],
       [tr('Índice UV', 'UV index', 'Índice UV'), uvText(w.uv)],
       [tr('Qualidade do ar', 'Air quality', 'Calidad del aire'), airText(Data.air)],
       [tr('Nascer do sol', 'Sunrise', 'Amanecer'), w.sunrise ? Data.time(w.sunrise) : '—'],
       [tr('Pôr do sol', 'Sunset', 'Atardecer'), w.sunset ? Data.time(w.sunset) : '—']].forEach(function (f) {
        var x = el('div', 'fact', facts);
        el('div', 'k', x, f[0]);
        el('div', 'v', x, f[1]);
      });
      var hours = el('div', 'wxhours', box), list = (w.hourly || w.hours || []).slice(0, 12);
      list.forEach(function (h) {
        var x = el('div', 'h', hours);
        el('div', 't', x, Data.hour(h.at));
        sym(Data.symbol(h.code, h.day), x);
        el('div', 'd', x, Data.degrees(h.temp));
        el('div', 'p', x, h.pop ? h.pop + '%' : '');
      });
      var days = el('div', 'wxdays', box), ds = w.days || [];
      if (!ds.length) return;
      var lo = Math.min.apply(null, ds.map(function (d) { return d.min; })), hi = Math.max.apply(null, ds.map(function (d) { return d.max; })), span = hi - lo || 1;
      ds.forEach(function (d, i) {
        var x = el('div', 'day', days);
        el('div', 'n', x, i === 0 ? tr('Hoje', 'Today', 'Hoy') : weekday(new Date(d.at)));
        sym(Data.symbol(d.code === null ? 2 : d.code, true), x);
        el('div', 'p', x, d.pop ? d.pop + '%' : '');
        el('div', 'lo', x, Data.degrees(d.min));
        var bar = el('div', 'bar', x), fill = el('div', 'fill', bar);
        fill.style.left = ((d.min - lo) / span * 100) + '%';
        fill.style.width = Math.max(4, (d.max - d.min) / span * 100) + '%';
        el('div', 'hi', x, Data.degrees(d.max));
      });
    }};
  };

  // MARK: - 2.1: the markets: the quotes on top, the person's own (stocks, funds, indexes, currencies, coins) and a chart for each

  // Ready to add: Yahoo Finance symbols (y) and Binance coins in dollars (b).
  var TICKER_PRESETS = [
    ['y', '^GSPC', 'S&P 500'], ['y', '^IXIC', 'Nasdaq'], ['y', '^IBEX', 'IBEX 35'], ['y', '^STOXX50E', 'Euro Stoxx 50'], ['y', 'GC=F', tr('Ouro', 'Gold', 'Oro')],
    ['y', 'AAPL', 'Apple'], ['y', 'MSFT', 'Microsoft'], ['y', 'NVDA', 'Nvidia'], ['y', 'AMZN', 'Amazon'], ['y', 'TSLA', 'Tesla'], ['y', 'GOOGL', 'Alphabet'],
    ['y', 'SAN.MC', 'Santander'], ['y', 'ITX.MC', 'Inditex'], ['y', 'IBE.MC', 'Iberdrola'],
    ['y', 'EURUSD=X', 'EUR/USD'], ['y', 'EURGBP=X', 'EUR/GBP'], ['y', 'USDJPY=X', 'USD/JPY'], ['y', 'BRL=X', 'USD/BRL'],
    ['b', 'ADA', 'Cardano'], ['b', 'DOGE', 'Dogecoin'], ['b', 'BNB', 'BNB'], ['b', 'DOT', 'Polkadot']
  ];

  var BUILTIN_SPARK = {0: ['b', 'BTC'], 1: ['b', 'ETH'], 2: ['b', 'SOL'], 4: ['b', 'XRP'], 5: ['y', 'CSPX.L'], 6: ['y', 'CNDX.L']};
  var quoteData = {};   // 'y:AAPL' → {price, change, cur, spark: [...], at}
  var RANGES = [['1d', '15m', tr('1 dia', '1 day', '1 día')], ['5d', '1h', tr('5 dias', '5 days', '5 días')], ['1mo', '1d', tr('1 mês', '1 month', '1 mes')], ['1y', '1wk', tr('1 ano', '1 year', '1 año')]];

  function tickers() { var t = Prefs.opt('tickers', []); return t instanceof Array ? t : []; }

  /** Price, change and a 24-hour line for one symbol; done(data). Cached five minutes. */
  function fetchQuote(kind, symbol, done, range) {
    var key = kind + ':' + symbol + (range ? ':' + range[0] : ''), have = quoteData[key];
    if (have && Date.now() - have.at < 5 * 60000) { done(have); return; }
    function keep(d) { d.at = Date.now(); quoteData[key] = d; done(d); }
    if (kind === 'b') {
      var lim = range ? {'1d': ['15m', 96], '5d': ['1h', 120], '1mo': ['4h', 180], '1y': ['1w', 52]}[range[0]] : ['1h', 24];
      Data.getJson('https://api.binance.com/api/v3/klines?symbol=' + symbol + 'USDT&interval=' + lim[0] + '&limit=' + lim[1], function (err, k) {
        if (err || !(k instanceof Array) || !k.length) { done(null); return; }
        var closes = k.map(function (x) { return parseFloat(x[4]); }), first = parseFloat(k[0][1]), last = closes[closes.length - 1];
        keep({price: last, change: first > 0 ? (last - first) / first * 100 : NaN, cur: 'USD', spark: closes});
      });
      return;
    }
    var r = range || ['1d', '15m'];
    var hosts = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
    (function next(h) {
      if (h >= hosts.length) { done(null); return; }
      Data.getJson(hosts[h] + '/v8/finance/chart/' + encodeURIComponent(symbol) + '?range=' + r[0] + '&interval=' + r[1], function (err, body) {
        var res = body && body.chart && body.chart.result && body.chart.result[0];
        if (err || !res || !res.meta || !(res.meta.regularMarketPrice > 0)) { next(h + 1); return; }
        var m = res.meta, q = res.indicators && res.indicators.quote && res.indicators.quote[0], closes = q && q.close ? q.close : [];
        var prev = r[0] === '1d' ? (m.chartPreviousClose || m.previousClose) : closes.filter(function (x) { return x !== null; })[0];
        keep({price: m.regularMarketPrice, change: prev > 0 ? (m.regularMarketPrice - prev) / prev * 100 : NaN, cur: m.currency || '', spark: closes,
          name: m.shortName || m.longName || ''});
      });
    })(0);
  }

  function money(v, cur) {
    if (v === undefined || v === null || isNaN(v)) return '—';
    var s = {USD: '$', EUR: '€', GBP: '£', JPY: '¥', BRL: 'R$ '}[cur] || '';
    var digits = v >= 1000 ? 0 : v >= 10 ? 2 : 4;
    try { return s + v.toLocaleString(I18N.locale(), {minimumFractionDigits: Math.min(digits, 2), maximumFractionDigits: digits}); } catch (e) { return s + v.toFixed(digits); }
  }

  /** Every quote the markets sheet shows: the top row's (bitcoin, funds…) then the person's own. */
  function marketItems() {
    var out = Data.activeCoins().map(function (i) {
      var s = BUILTIN_SPARK[i];
      return {name: Data.coinName(i), price: Data.money(Data.prices[i], i), change: Data.changes[i], kind: s ? s[0] : '', sym: s ? s[1] : '', builtin: true};
    });
    tickers().forEach(function (t) {
      var d = quoteData[t.k + ':' + t.s];
      out.push({name: t.n || t.s, price: d ? money(d.price, d.cur) : '—', change: d ? d.change : NaN, kind: t.k, sym: t.s, ticker: t});
    });
    return out;
  }

  /** Brings the person's quotes up to date, then redraws what shows them; checks the price alerts. */
  function refreshTickers() {
    var list = tickers();
    list.forEach(function (t) {
      fetchQuote(t.k, t.s, function (d) {
        if (!d) return;
        checkAlerts(t, d.price);
        renderQuotes();
        if (st.zone === Z.INFO && (info.kind === 'markets' || info.kind === 'widgets')) renderInfo();
      });
    });
  }

  INFO.markets = function () {
    var items = marketItems(), rows = items.map(function (q) {
      return {label: q.name, value: q.price + (isNaN(q.change) ? '' : '   ' + Data.change(q.change)), plain: true, spark: q,
        run: function () { if (q.sym) openInfo('ticker', q); }};
    });
    rows.push({label: tr('Adicionar um valor…', 'Add a quote…', 'Añadir un valor…'), value: '›', icon: 'search', run: function () { openInfo('addTicker'); }});
    rows.push({label: tr('Alertas de preço', 'Price alerts', 'Alertas de precio'), value: String(alerts().length), plain: true, icon: 'bell',
      run: function () { toast(tr('Abra um valor para criar um alerta', 'Open a quote to set an alert', 'Abre un valor para crear una alerta')); }});
    return {title: tr('Mercados', 'Markets', 'Mercados'), icon: 'bitcoin', visible: 7, rows: rows,
      hint: tr('OK abre o gráfico · Voltar fecha · só informação, não é conselho de investimento', 'OK opens the chart · Back closes · information only, not investment advice',
        'OK abre la gráfica · Atrás cierra · solo información, no es consejo de inversión'),
      build: function (box) { setClass(box, 'wide', true); }};
  };

  INFO.addTicker = function () {
    var have = tickers().map(function (t) { return t.k + ':' + t.s; });
    var rows = [{label: tr('Escrever outro símbolo…', 'Type another symbol…', 'Escribir otro símbolo…'), value: '›', icon: 'search', run: function () {
      askText(tr('Símbolo', 'Symbol', 'Símbolo'), tr('Como no Yahoo Finance: AAPL, SAN.MC, ^IBEX, EURUSD=X… Para uma criptomoeda: o seu nome curto (ADA, DOGE…).',
        'As on Yahoo Finance: AAPL, SAN.MC, ^IBEX, EURUSD=X… For a coin: its short name (ADA, DOGE…).',
        'Como en Yahoo Finance: AAPL, SAN.MC, ^IBEX, EURUSD=X… Para una criptomoneda: su nombre corto (ADA, DOGE…).'), '', function (v) {
        var s = trim(v).toUpperCase();
        if (!s) return;
        var coin = /^[A-Z0-9]{2,6}$/.test(s) && !/[.^=]/.test(s);
        toast(tr('Procurando ', 'Looking up ', 'Buscando ') + s + '…');
        fetchQuote(coin ? 'b' : 'y', s, function (d) {
          if (!d && coin) { fetchQuote('y', s, function (d2) { if (d2) addTicker('y', s, d2.name || s); else toast(tr('Não encontrei ', 'Not found: ', 'No encontré ') + s); }); return; }
          if (!d) { toast(tr('Não encontrei ', 'Not found: ', 'No encontré ') + s); return; }
          addTicker(coin ? 'b' : 'y', s, d.name || s);
        });
      });
    }}];
    TICKER_PRESETS.forEach(function (p) {
      if (have.indexOf(p[0] + ':' + p[1]) >= 0) return;
      rows.push({label: p[2], value: p[1], plain: true, run: function () { addTicker(p[0], p[1], p[2]); }});
    });
    return {title: tr('Adicionar um valor', 'Add a quote', 'Añadir un valor'), icon: 'bitcoin', visible: 7, rows: rows, back: function () { openInfo('markets'); }};
  };

  function addTicker(kind, symbol, name) {
    var list = tickers().filter(function (t) { return !(t.k === kind && t.s === symbol); });
    list.push({k: kind, s: symbol, n: name, top: false});
    Prefs.set('tickers', list.slice(-20));
    toast(name + ': ' + tr('adicionado', 'added', 'añadido'));
    refreshTickers();
    openInfo('markets');
  }

  INFO.ticker = function (q) {
    var range = RANGES[+Prefs.opt('tickerRange', 1)] || RANGES[1], t = q.ticker, d = quoteData[q.kind + ':' + q.sym + ':' + range[0]];
    var rows = [{label: tr('Período', 'Range', 'Periodo'), value: range[2], step: function (dx) {
      Prefs.set('tickerRange', (+Prefs.opt('tickerRange', 1) + (dx || 1) + RANGES.length) % RANGES.length);
    }}];
    rows.push({label: tr('Avisar se passar de…', 'Tell me if it goes above…', 'Avisarme si sube de…'), value: '›', icon: 'bell', run: function () { askAlert(q, 'above'); }});
    rows.push({label: tr('Avisar se cair abaixo de…', 'Tell me if it falls below…', 'Avisarme si baja de…'), value: '›', icon: 'bell', run: function () { askAlert(q, 'below'); }});
    if (t) {
      rows.push({label: tr('Na fila de cima', 'In the top row', 'En la fila de arriba'), toggle: !!t.top, step: function () {
        Prefs.set('tickers', tickers().map(function (x) { if (x.k === t.k && x.s === t.s) x.top = !x.top; return x; }));
        t.top = !t.top;
        renderQuotes();
      }});
      rows.push({label: tr('Tirar dos meus valores', 'Remove from my quotes', 'Quitar de mis valores'), value: '›', run: function () {
        Prefs.set('tickers', tickers().filter(function (x) { return !(x.k === t.k && x.s === t.s); }));
        renderQuotes();
        openInfo('markets');
      }});
    }
    return {title: q.name, icon: 'bitcoin', rows: rows, back: function () { openInfo('markets'); }, build: function (box) {
      setClass(box, 'wide', true);
      var head = el('div', 'tkhead', box);
      el('div', 'price', head, d ? money(d.price, d.cur) : q.price);
      var ch = d ? d.change : q.change;
      if (!isNaN(ch)) el('div', 'change ' + (ch >= 0 ? 'up' : 'down'), head, Data.change(ch) + ' · ' + range[2]);
      el('div', 'sym', head, q.sym);
      var canvas = el('canvas', 'tkchart', box);
      canvas.width = 1440;
      canvas.height = 300;
      if (d) chart(canvas, d.spark, {line: 4, pad: 8});
      else fetchQuote(q.kind, q.sym, function (d2) { if (d2 && st.zone === Z.INFO && info.kind === 'ticker') renderInfo(); }, range);
    }};
  };

  // Price alerts: {k, s, n, above|below: price}. Checked when a quote arrives; a toast and a dialog, once.
  function alerts() { var a = Prefs.opt('alerts', []); return a instanceof Array ? a : []; }

  function askAlert(q, side) {
    askText(side === 'above' ? tr('Avisar acima de', 'Alert above', 'Avisar por encima de') : tr('Avisar abaixo de', 'Alert below', 'Avisar por debajo de'),
      q.name + ' · ' + tr('agora ', 'now ', 'ahora ') + q.price, '', function (v) {
        var n = parseFloat(String(v).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
        if (!(n > 0)) { toast(tr('Escreva um número', 'Type a number', 'Escribe un número')); return; }
        var a = {k: q.kind, s: q.sym, n: q.name};
        a[side] = n;
        Prefs.set('alerts', alerts().concat([a]).slice(-20));
        toast(tr('Alerta criado', 'Alert set', 'Alerta creada'));
      }, '0');
  }

  function checkAlerts(t, price) {
    if (!(price > 0)) return;
    var left = [], fired = [];
    alerts().forEach(function (a) {
      if (a.k === t.k && a.s === t.s && ((a.above && price >= a.above) || (a.below && price <= a.below))) fired.push(a);
      else left.push(a);
    });
    if (!fired.length) return;
    Prefs.set('alerts', left);
    fired.forEach(function (a) {
      var text = a.n + ': ' + money(price, '') + (a.above ? tr(' passou de ', ' went above ', ' superó ') + a.above : tr(' caiu abaixo de ', ' fell below ', ' bajó de ') + a.below);
      toast(text);
      if (!saverOn && !sheetOpen()) showDialog(tr('Alerta de preço', 'Price alert', 'Alerta de precio'), [{text: text}], [{label: 'OK'}], 0);
    });
  }

  // Alerts for the top row's coins too: they come with Data's prices.
  function checkBuiltinAlerts() {
    Data.activeCoins().forEach(function (i) {
      var s = BUILTIN_SPARK[i];
      if (s) checkAlerts({k: s[0], s: s[1]}, Data.prices[i]);
    });
  }

  // MARK: - 2.1: my widgets: calendar, countdowns, notes, football, news, currencies

  var WIDGETS = ['calendar', 'countdown', 'notes', 'football', 'news', 'fx'];
  function widgetName(w) {
    return {calendar: tr('Calendário', 'Calendar', 'Calendario'), countdown: tr('Contagem regressiva', 'Countdown', 'Cuenta atrás'), notes: tr('Notas', 'Notes', 'Notas'),
      football: tr('Futebol', 'Football', 'Fútbol'), news: tr('Notícias', 'News', 'Noticias'), fx: tr('Moedas', 'Currencies', 'Divisas')}[w];
  }
  function widgetOn(w) { var off = Prefs.opt('widgetsOff', []); return !(off instanceof Array) || off.indexOf(w) < 0; }

  // Public holidays (Nager.Date, by the TV's country), kept per year.
  function holidays(year, done) {
    var key = 'hol' + Data.country + year, have = cache(key);
    if (have) { done(have); return; }
    Data.getJson('https://date.nager.at/api/v3/PublicHolidays/' + year + '/' + Data.country, function (err, list) {
      if (err || !(list instanceof Array)) { done([]); return; }
      done(cache(key, list.map(function (h) { return {d: h.date, n: h.localName || h.name}; })));
    });
  }

  function countdowns() {
    var c = Prefs.opt('countdowns', null), y = new Date().getFullYear(), today = dayKey();
    if (!(c instanceof Array) || !c.length) {
      c = [{n: tr('Natal', 'Christmas', 'Navidad'), d: y + '-12-25'}, {n: tr('Ano Novo', 'New Year', 'Año Nuevo'), d: (y + 1) + '-01-01'}];
    }
    return c.map(function (x) {
      var d = x.d;
      if (/^\d{2}-\d{2}$/.test(d)) d = y + '-' + d;   // every year: the next one
      if (d < today && /^\d{4}-\d{2}-\d{2}$/.test(d) && x.yearly) d = (y + 1) + d.slice(4);
      var t = Date.parse(d + 'T00:00:00'), days = Math.ceil((t - Date.parse(today + 'T00:00:00')) / 864e5);
      return {n: x.n, d: d, days: days, raw: x};
    }).filter(function (x) { return x.days >= 0; }).sort(function (a, b) { return a.days - b.days; });
  }

  function notes() { var n = Prefs.opt('notes', []); return n instanceof Array ? n : []; }

  var football = cache('football') || null, footballAt = 0;
  function refreshFootball(done) {
    var team = Prefs.opt('team', null);
    if (!team || !team.id || Date.now() - footballAt < 30 * 60000) { if (done) done(); return; }
    footballAt = Date.now();
    var base = 'https://www.thesportsdb.com/api/v1/json/123/', out = {id: team.id};
    Data.getJson(base + 'eventsnext.php?id=' + team.id, function (e1, a) {
      out.next = a && a.events ? a.events.slice(0, 2) : [];
      Data.getJson(base + 'eventslast.php?id=' + team.id, function (e2, b) {
        out.last = b && b.results ? b.results.slice(0, 2) : [];
        football = cache('football', out);
        if (done) done();
      });
    });
  }

  function matchText(e, past) {
    if (!e) return '';
    var when = e.strTimestamp ? new Date(e.strTimestamp + (/Z$/.test(e.strTimestamp) ? '' : 'Z')) : null;
    var score = past && e.intHomeScore !== null && e.intHomeScore !== undefined ? '  ' + e.intHomeScore + ' - ' + e.intAwayScore : '';
    var date = when && !isNaN(when.getTime()) ? weekday(when) + ' ' + when.getDate() + '/' + (when.getMonth() + 1) + (past ? '' : ' ' + hhmm(when)) : (e.dateEvent || '');
    return (e.strHomeTeam || '') + ' – ' + (e.strAwayTeam || '') + score + '   ·   ' + date + (e.strLeague ? '   ·   ' + e.strLeague : '');
  }

  // News: an RSS feed, read by the TV's store service (the screen cannot: no CORS). The first eight headlines, every 20 minutes.
  var NEWS_PRESETS = [
    ['Google News', function () { var c = Data.country, l = I18N.lang === 'pt' ? 'pt-BR' : I18N.lang; return 'https://news.google.com/rss?hl=' + l + '&gl=' + c + '&ceid=' + c + ':' + l.slice(0, 2); }],
    ['El País', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada'],
    ['RTVE', 'https://api2.rtve.es/rss/temas_noticias.xml'],
    ['BBC News', 'https://feeds.bbci.co.uk/news/rss.xml'],
    ['G1', 'https://g1.globo.com/rss/g1/'],
    ['Xataka', 'https://www.xataka.com/feedburner.xml']
  ];
  var news = cache('news') || null, newsAt = 0;

  function newsUrl() {
    var u = Prefs.opt('newsUrl', '');
    if (u) return u;
    return NEWS_PRESETS[0][1]();
  }

  function refreshNews(done) {
    if (Date.now() - newsAt < 20 * 60000) { if (done) done(); return; }
    newsAt = Date.now();
    var url = newsUrl();
    function parse(text) {
      try {
        var doc = new DOMParser().parseFromString(text, 'text/xml'), items = doc.getElementsByTagName('item'), out = [];
        for (var i = 0; i < items.length && out.length < 8; i++) {
          var t = items[i].getElementsByTagName('title')[0];
          if (t && t.textContent) out.push(trim(t.textContent).replace(/\s+-\s+[^-]{2,40}$/, ''));
        }
        if (out.length) news = cache('news', {url: url, items: out, at: Date.now()});
      } catch (e) {}
      if (done) done();
    }
    if (TV.name === 'webos') {
      svcCall('feed', {url: url}, function (r) { if (r && r.returnValue && r.text) parse(r.text); else if (done) done(); });
    } else {
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.onreadystatechange = function () { if (x.readyState === 4) { if (x.status === 200) parse(x.responseText); else if (done) done(); } };
      x.send();
    }
  }

  var FX = [['EURUSD=X', 'EUR → USD'], ['EURGBP=X', 'EUR → GBP'], ['USDJPY=X', 'USD → JPY'], ['EURBRL=X', 'EUR → BRL']];

  function calendarCard(box) {
    var card = el('div', 'wcard cal', box), now = new Date(), y = now.getFullYear(), m = now.getMonth();
    var head = el('div', 'wh', card);
    try { head.textContent = now.toLocaleDateString(I18N.locale(), {month: 'long', year: 'numeric'}); } catch (e) { head.textContent = (m + 1) + '/' + y; }
    var grid = el('div', 'grid', card), first = new Date(y, m, 1), shift = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    for (var w = 0; w < 7; w++) el('div', 'wd', grid, weekday(new Date(2024, 0, 1 + w)).slice(0, 2));
    for (var s = 0; s < shift; s++) el('div', 'c', grid, '');
    var cells = {};
    for (var d = 1; d <= days; d++) cells[d] = el('div', 'c' + (d === now.getDate() ? ' today' : ''), grid, String(d));
    var next = el('div', 'list', card);
    holidays(y, function (list) {
      var today = dayKey(), shown = 0;
      list.forEach(function (h) {
        var hd = +h.d.slice(8, 10);
        if (+h.d.slice(5, 7) === m + 1 && cells[hd]) setClass(cells[hd], 'hol', true);
        if (h.d >= today && shown < 3) { shown++; el('div', 'li', next, h.d.slice(8, 10) + '/' + h.d.slice(5, 7) + '  ' + h.n); }
      });
    });
  }

  INFO.widgets = function () {
    var rows = [];
    if (widgetOn('countdown')) rows.push({label: tr('Nova contagem regressiva…', 'New countdown…', 'Nueva cuenta atrás…'), value: '›', icon: 'timer', run: addCountdown});
    if (widgetOn('notes')) rows.push({label: tr('Nova nota ou lembrete…', 'New note or reminder…', 'Nueva nota o recordatorio…'), value: '›', icon: 'bell', run: addNote});
    if (widgetOn('notes') && notes().length) rows.push({label: tr('Apagar as notas', 'Clear the notes', 'Borrar las notas'), value: String(notes().length), plain: true, run: function () { Prefs.set('notes', []); }});
    if (widgetOn('football')) rows.push({label: tr('Meu time', 'My team', 'Mi equipo'), value: (Prefs.opt('team', null) || {}).name || '›', run: askTeam});
    if (widgetOn('news')) rows.push({label: tr('Notícias de', 'News from', 'Noticias de'), value: newsName(), step: function (d) { cycleNews(d); }});
    rows.push({label: tr('Quais widgets mostrar', 'Which widgets to show', 'Qué widgets mostrar'), value: '›', icon: 'settings', run: function () { openSettings(); settingsCat = 'widgets'; renderSettings(); }});
    return {title: tr('Meus widgets', 'My widgets', 'Mis widgets'), icon: 'partly_cloudy_day', rows: rows, visible: 3, build: function (box) {
      setClass(box, 'wide', true);
      var grid = el('div', 'wgrid', box);
      if (widgetOn('calendar')) calendarCard(grid);
      if (widgetOn('countdown')) {
        var c = el('div', 'wcard', grid);
        el('div', 'wh', c, widgetName('countdown'));
        countdowns().slice(0, 4).forEach(function (x) {
          var r = el('div', 'kv', c);
          el('span', 'k', r, x.n);
          el('span', 'v', r, x.days === 0 ? tr('hoje', 'today', 'hoy') : x.days + ' ' + plural(x.days, tr('dia', 'day', 'día'), tr('dias', 'days', 'días')));
        });
      }
      if (widgetOn('notes')) {
        var n = el('div', 'wcard', grid);
        el('div', 'wh', n, widgetName('notes'));
        var list = notes();
        if (!list.length) el('div', 'li dim', n, tr('Nenhuma nota. Crie uma abaixo.', 'No notes. Make one below.', 'Ninguna nota. Crea una abajo.'));
        list.slice(-5).forEach(function (x) { el('div', 'li', n, (x.at ? '⏰ ' + x.at + '  ' : '• ') + x.t); });
      }
      if (widgetOn('football')) {
        var f = el('div', 'wcard', grid), team = Prefs.opt('team', null);
        el('div', 'wh', f, team ? team.name : widgetName('football'));
        if (!team) el('div', 'li dim', f, tr('Escolha seu time abaixo.', 'Pick your team below.', 'Elige tu equipo abajo.'));
        else if (football && football.id === team.id) {
          el('div', 'k', f, tr('Próximo', 'Next', 'Próximo'));
          el('div', 'li', f, football.next && football.next[0] ? matchText(football.next[0]) : '—');
          el('div', 'k', f, tr('Último', 'Last', 'Último'));
          el('div', 'li', f, football.last && football.last[0] ? matchText(football.last[0], true) : '—');
        } else { el('div', 'li dim', f, tr('Carregando…', 'Loading…', 'Cargando…')); refreshFootball(function () { if (st.zone === Z.INFO && info.kind === 'widgets') renderInfo(); }); }
      }
      if (widgetOn('fx')) {
        var x = el('div', 'wcard', grid);
        el('div', 'wh', x, widgetName('fx'));
        FX.forEach(function (p) {
          var d = quoteData['y:' + p[0]], r = el('div', 'kv', x);
          el('span', 'k', r, p[1]);
          el('span', 'v', r, d ? d.price.toFixed(p[0] === 'USDJPY=X' ? 2 : 4) : '…');
          if (!d) fetchQuote('y', p[0], function (q) { if (q && st.zone === Z.INFO && info.kind === 'widgets') renderInfo(); });
        });
      }
      if (widgetOn('news')) {
        var w = el('div', 'wcard news', grid);
        el('div', 'wh', w, widgetName('news') + ' · ' + newsName());
        if (news && news.url === newsUrl()) news.items.slice(0, 6).forEach(function (t) { el('div', 'li', w, t); });
        else el('div', 'li dim', w, tr('Carregando…', 'Loading…', 'Cargando…'));
        refreshNews(function () { if (st.zone === Z.INFO && info.kind === 'widgets' && news && news.url === newsUrl()) renderInfo(); });
      }
    }};
  };

  function newsName() {
    var u = Prefs.opt('newsUrl', '');
    if (!u) return NEWS_PRESETS[0][0];
    for (var i = 1; i < NEWS_PRESETS.length; i++) if (NEWS_PRESETS[i][1] === u) return NEWS_PRESETS[i][0];
    return u.replace(/^https:\/\/(www\.)?/, '').split('/')[0];
  }

  function cycleNews(d) {
    var names = NEWS_PRESETS.map(function (p) { return p[0]; }).concat([tr('Outro endereço…', 'Another address…', 'Otra dirección…')]), i = names.indexOf(newsName());
    i = (i < 0 ? 0 : i + (d || 1) + names.length) % names.length;
    newsAt = 0;
    if (i === names.length - 1) {
      askText(tr('Endereço RSS', 'RSS address', 'Dirección RSS'), tr('O endereço https do feed RSS.', 'The https address of the RSS feed.', 'La dirección https del canal RSS.'), Prefs.opt('newsUrl', ''), function (v) {
        if (/^https:\/\//.test(trim(v))) { Prefs.set('newsUrl', trim(v)); newsAt = 0; openInfo('widgets'); } else toast(tr('Precisa começar com https://', 'It must start with https://', 'Tiene que empezar por https://'));
      }, 'https://');
      return;
    }
    Prefs.set('newsUrl', i === 0 ? '' : NEWS_PRESETS[i][1]);
  }

  function addCountdown() {
    askText(tr('Contagem regressiva', 'Countdown', 'Cuenta atrás'), tr('O nome (Férias, Aniversário da Ana…).', 'Its name (Holidays, Ana\'s birthday…).', 'Su nombre (Vacaciones, Cumple de Ana…).'), '', function (name) {
      name = trim(name);
      if (!name) return;
      askText(name, tr('A data: DD/MM ou DD/MM/AAAA (sem ano: todo ano).', 'The date: DD/MM or DD/MM/YYYY (no year: every year).', 'La fecha: DD/MM o DD/MM/AAAA (sin año: todos los años).'), '', function (v) {
        var m = /^\s*(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\s*$/.exec(v || '');
        if (!m || +m[1] > 31 || +m[2] > 12) { toast(tr('Data não entendida', 'Date not understood', 'No entendí la fecha')); return; }
        var year = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : 0, md = pad2(+m[2]) + '-' + pad2(+m[1]);
        var item = year ? {n: name, d: year + '-' + md} : {n: name, d: md, yearly: true};
        var list = Prefs.opt('countdowns', null);
        Prefs.set('countdowns', (list instanceof Array ? list : []).concat([item]).slice(-10));
        openInfo('widgets');
      }, 'DD/MM');
    });
  }

  function addNote() {
    askText(tr('Nota', 'Note', 'Nota'), tr('O que lembrar.', 'What to remember.', 'Qué recordar.'), '', function (text) {
      text = trim(text);
      if (!text) return;
      askText(tr('Lembrete', 'Reminder', 'Recordatorio'), tr('A que horas avisar (HH:MM), ou vazio para só guardar a nota.', 'When to remind you (HH:MM), or empty to just keep the note.',
        'A qué hora avisarte (HH:MM), o vacío para solo guardar la nota.'), '', function (t) {
        Prefs.set('notes', notes().concat([{t: text, at: parseTime(t)}]).slice(-12));
        openInfo('widgets');
      }, 'HH:MM');
    });
  }

  function askTeam() {
    askText(tr('Seu time', 'Your team', 'Tu equipo'), tr('O nome do time (Real Betis, Flamengo, Arsenal…).', 'The team\'s name (Real Betis, Flamengo, Arsenal…).', 'El nombre del equipo (Real Betis, Flamengo, Arsenal…).'), '', function (q) {
      q = trim(q);
      if (!q) return;
      Data.getJson('https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=' + encodeURIComponent(q), function (err, d) {
        var teams = d && d.teams ? d.teams.filter(function (t) { return t.strSport === 'Soccer' || !t.strSport; }).slice(0, 5) : [];
        if (!teams.length) { toast(tr('Não encontrei ', 'Not found: ', 'No encontré ') + q); return; }
        showDialog(tr('Qual?', 'Which one?', '¿Cuál?'), [], teams.map(function (t) {
          return {label: t.strTeam + (t.strCountry ? ' · ' + t.strCountry : ''), run: function () {
            Prefs.set('team', {id: t.idTeam, name: t.strTeam});
            footballAt = 0;
            refreshFootball(function () { openInfo('widgets'); });
          }};
        }).concat([{label: cancelText()}]), 0);
      });
    });
  }

  // Reminders: a note with a time shows once that day, at that time.
  function checkReminders() {
    var now = hhmm(), today = dayKey(), shown = Prefs.opt('remShown', {}) || {};
    notes().forEach(function (n) {
      if (!n.at || n.at !== now || shown[n.t + n.at] === today) return;
      shown[n.t + n.at] = today;
      Prefs.set('remShown', shown);
      if (saverOn) hideSaver();
      showDialog.icon = 'bell';
      showDialog(tr('Lembrete', 'Reminder', 'Recordatorio'), [{text: n.t}], [{label: 'OK'}], 0);
    });
  }

  // MARK: - 2.1: profiles. Family, Kids and Guest each keep their own shelf, tabs and look; a PIN can guard one.

  var PROFILES = ['family', 'kids', 'guest'];
  var PROFILE_KEYS = ['shelf', 'tabOrder', 'tabHidden', 'tabNames', 'accent', 'theme', 'wallpaper', 'wallUrl', 'glass', 'glassLevel', 'calm', 'iconSize', 'textSize',
    'corners', 'titleMode', 'name', 'quickHidden', 'quickApps', 'motion', 'topClock', 'topDate', 'iconNames', 'cardSize', 'startTab', 'look', 'placesRegion', 'saver'];

  function profileName(p) { return {family: tr('Família', 'Family', 'Familia'), kids: tr('Crianças', 'Kids', 'Niños'), guest: tr('Convidado', 'Guest', 'Invitado')}[p] || p; }
  function profileNow() { var p = Prefs.opt('profile', 'family'); return PROFILES.indexOf(p) >= 0 ? p : 'family'; }
  function profiles() { var p = Prefs.opt('profiles', {}); return p && typeof p === 'object' ? p : {}; }

  function switchProfile(to, sure) {
    var from = profileNow(), all = profiles();
    if (to === from) return;
    var pinNeeded = all[to] && all[to].pin;
    if (pinNeeded && !sure) {
      askPin(profileName(to), tr('Digite o PIN deste perfil.', 'Type this profile\'s PIN.', 'Escribe el PIN de este perfil.'), function (d) {
        if (d === all[to].pin) switchProfile(to, true); else toast(tr('PIN incorreto', 'Wrong PIN', 'PIN incorrecto'));
      });
      return;
    }
    var mine = {};
    PROFILE_KEYS.forEach(function (k) { var v = Prefs.opt(k, undefined); if (v !== undefined) mine[k] = v; });
    all[from] = all[from] || {};
    all[from].data = mine;
    var theirs = (all[to] && all[to].data) || null;
    PROFILE_KEYS.forEach(function (k) { if (theirs) Prefs.set(k, theirs[k]); });
    Prefs.set('profiles', all);
    Prefs.set('profile', to);
    closeSheets();
    applyLook();
    pickShelf();
    cards = [];
    renderAll();
    toast(tr('Perfil: ', 'Profile: ', 'Perfil: ') + profileName(to));
  }

  function nextProfile() { switchProfile(PROFILES[(PROFILES.indexOf(profileNow()) + 1) % PROFILES.length]); }

  INFO.profiles = function () {
    var all = profiles(), now = profileNow(), rows = PROFILES.map(function (p) {
      return {label: profileName(p), value: p === now ? '✓ ' + tr('agora', 'now', 'ahora') : (all[p] && all[p].pin ? '🔒' : '›'), plain: p === now, run: function () { switchProfile(p); }};
    });
    PROFILES.forEach(function (p) {
      rows.push({label: tr('PIN para ', 'PIN for ', 'PIN para ') + profileName(p), toggle: !!(all[p] && all[p].pin), step: function () {
        var a = profiles();
        if (a[p] && a[p].pin) {
          askPin(profileName(p), tr('Digite o PIN atual para tirá-lo.', 'Type the current PIN to remove it.', 'Escribe el PIN actual para quitarlo.'), function (d) {
            if (d !== a[p].pin) { toast(tr('PIN incorreto', 'Wrong PIN', 'PIN incorrecto')); return; }
            delete a[p].pin; Prefs.set('profiles', a); openInfo('profiles');
          });
          return;
        }
        askPin(profileName(p), tr('Escolha 4 números para este perfil.', 'Choose 4 digits for this profile.', 'Elige 4 cifras para este perfil.'), function (d) {
          a[p] = a[p] || {}; a[p].pin = d; Prefs.set('profiles', a); openInfo('profiles');
        });
      }});
    });
    return {title: tr('Perfis', 'Profiles', 'Perfiles'), icon: 'home', rows: rows, visible: 6,
      hint: tr('Cada perfil guarda sua prateleira, abas e aparência · OK troca', 'Each profile keeps its shelf, tabs and look · OK switches', 'Cada perfil guarda su estante, pestañas y aspecto · OK cambia')};
  };

  // MARK: - 2.1: tabs: show, hide, reorder, rename

  function tabOrder() {
    var o = Prefs.opt('tabOrder', null), out = [];
    if (o instanceof Array) o.forEach(function (i) { if (i >= 0 && i <= 4 && out.indexOf(i) < 0) out.push(i); });
    for (var i = 0; i < 5; i++) if (out.indexOf(i) < 0) out.push(i);
    return out;
  }

  INFO.tabs = function () {
    var order = tabOrder(), hidden = Prefs.opt('tabHidden', []) || [], names = tabNames(), rows = [];
    order.forEach(function (t, pos) {
      rows.push({label: names[t], value: (hidden.indexOf(t) >= 0 ? tr('Oculta', 'Hidden', 'Oculta') : tr('Visível', 'Shown', 'Visible')) + ' · ' + (pos + 1) + 'º',
        step: function (d) {
          if (d === 1) {   // OK: show or hide
            var h = (Prefs.opt('tabHidden', []) || []).slice(), at = h.indexOf(t);
            if (at >= 0) h.splice(at, 1);
            else if (order.length - h.length > 1) h.push(t);
            else { toast(tr('Uma aba fica sempre', 'One tab always stays', 'Siempre queda una pestaña')); return; }
            Prefs.set('tabHidden', h);
          }
          applyLook();
        },
        move: function (d) {
          var o = tabOrder(), i = o.indexOf(t), j = i + d;
          if (j < 0 || j >= o.length) return;
          o[i] = o[j];
          o[j] = t;
          Prefs.set('tabOrder', o);
          info.index = j;
          applyLook();
        }});
    });
    rows.push({label: tr('Renomear uma aba…', 'Rename a tab…', 'Renombrar una pestaña…'), value: '›', run: function () {
      showDialog(tr('Qual aba?', 'Which tab?', '¿Qué pestaña?'), [], tabOrder().map(function (t) {
        return {label: tabNames()[t], run: function () { renameTab(t); }};
      }).concat([{label: cancelText()}]), 0);
    }});
    rows.push({label: tr('Nomes originais', 'Original names', 'Nombres originales'), value: '›', run: function () { Prefs.set('tabNames', {}); applyLook(); renderTop(); }});
    return {title: tr('Abas', 'Tabs', 'Pestañas'), icon: 'apps', rows: rows, visible: 7,
      hint: tr('OK mostra ou oculta · ◀ ▶ mudam de lugar · Voltar fecha', 'OK shows or hides · ◀ ▶ move it · Back closes', 'OK la muestra u oculta · ◀ ▶ la mueven · Atrás cierra')};
  };

  function renameTab(t) {
    askText(tr('Novo nome', 'New name', 'Nuevo nombre'), tabNames()[t], tabNames()[t], function (v) {
      var n = Prefs.opt('tabNames', {}) || {};
      n[t] = trim(v).slice(0, 24);
      if (!n[t]) delete n[t];
      Prefs.set('tabNames', n);
      renderTop();
      if (st.zone !== Z.INFO) openInfo('tabs');
    });
  }

  // MARK: - 2.1: routines: at a time of day, do something (calm mode, the sleep timer, a theme, a profile…)

  var ROUTINE_ACTIONS = ['calm-on', 'calm-off', 'sleep-30', 'sleep-60', 'theme-dark', 'theme-light', 'theme-auto', 'saver', 'profile-family', 'profile-kids', 'profile-guest'];

  function routineName(a) {
    return {'calm-on': tr('Ligar o modo calmo', 'Calm mode on', 'Activar modo calma'), 'calm-off': tr('Desligar o modo calmo', 'Calm mode off', 'Quitar modo calma'),
      'sleep-30': tr('Desligar em 30 min', 'Sleep in 30 min', 'Apagar en 30 min'), 'sleep-60': tr('Desligar em 60 min', 'Sleep in 60 min', 'Apagar en 60 min'),
      'theme-dark': tr('Tema escuro', 'Dark theme', 'Tema oscuro'), 'theme-light': tr('Tema claro', 'Light theme', 'Tema claro'), 'theme-auto': tr('Tema automático', 'Automatic theme', 'Tema automático'),
      saver: tr('Protetor de tela', 'Screensaver', 'Salvapantallas'), 'profile-family': tr('Perfil Família', 'Family profile', 'Perfil Familia'),
      'profile-kids': tr('Perfil Crianças', 'Kids profile', 'Perfil Niños'), 'profile-guest': tr('Perfil Convidado', 'Guest profile', 'Perfil Invitado')}[a] || a;
  }

  function routines() { var r = Prefs.opt('routines', []); return r instanceof Array ? r : []; }

  function runRoutine(a) {
    if (a === 'calm-on' || a === 'calm-off') { Prefs.set('calm', a === 'calm-on'); applyLook(); }
    else if (a === 'sleep-30' || a === 'sleep-60') { if (TV.name === 'webos') sleepSet(a === 'sleep-30' ? 30 : 60); }
    else if (a.indexOf('theme-') === 0) { Prefs.set('theme', a.slice(6)); checkNight(); }
    else if (a === 'saver') { if (!saverOn && !document.hidden) showSaver(); }
    else if (a.indexOf('profile-') === 0) switchProfile(a.slice(8), true);
  }

  function checkRoutines() {
    var now = hhmm(), today = dayKey(), done = Prefs.opt('routineDone', {}) || {};
    routines().forEach(function (r, i) {
      if (r.t !== now || done[i + r.t + r.a] === today) return;
      done[i + r.t + r.a] = today;
      Prefs.set('routineDone', done);
      runRoutine(r.a);
      toast(tr('Rotina: ', 'Routine: ', 'Rutina: ') + routineName(r.a));
    });
  }

  INFO.routines = function () {
    var list = routines(), rows = list.map(function (r, i) {
      return {label: r.t + '  ·  ' + routineName(r.a), value: routineName(r.a), step: function (d) {
        var l = routines();
        if (d === 1) {
          showDialog(r.t + ' · ' + routineName(r.a), [], [
            {label: tr('Mudar a hora', 'Change the time', 'Cambiar la hora'), run: function () { askRoutineTime(i); }},
            {label: tr('Apagar a rotina', 'Delete the routine', 'Borrar la rutina'), run: function () { var x = routines(); x.splice(i, 1); Prefs.set('routines', x); openInfo('routines'); }},
            {label: cancelText()}], 0);
          return;
        }
        l[i].a = ROUTINE_ACTIONS[(ROUTINE_ACTIONS.indexOf(l[i].a) + d + ROUTINE_ACTIONS.length) % ROUTINE_ACTIONS.length];
        Prefs.set('routines', l);
      }, move: function (d) {
        var l = routines();
        l[i].a = ROUTINE_ACTIONS[(ROUTINE_ACTIONS.indexOf(l[i].a) + d + ROUTINE_ACTIONS.length) % ROUTINE_ACTIONS.length];
        Prefs.set('routines', l);
      }};
    });
    if (list.length < 8) rows.push({label: tr('Nova rotina…', 'New routine…', 'Nueva rutina…'), value: '›', icon: 'timer', run: function () { askRoutineTime(-1); }});
    return {title: tr('Rotinas', 'Routines', 'Rutinas'), icon: 'timer', rows: rows, visible: 7,
      hint: tr('◀ ▶ mudam o que faz · OK hora ou apagar · Voltar fecha', '◀ ▶ change what it does · OK time or delete · Back closes', '◀ ▶ cambian lo que hace · OK hora o borrar · Atrás cierra')};
  };

  function askRoutineTime(i) {
    askText(tr('Hora', 'Time', 'Hora'), tr('A que horas, todos os dias (HH:MM).', 'At what time, every day (HH:MM).', 'A qué hora, todos los días (HH:MM).'), i >= 0 ? routines()[i].t : '', function (v) {
      var t = parseTime(v);
      if (!t) { toast(tr('Hora não entendida', 'Time not understood', 'No entendí la hora')); return; }
      var l = routines();
      if (i >= 0) l[i].t = t; else l.push({t: t, a: 'calm-on'});
      Prefs.set('routines', l);
      openInfo('routines');
    }, 'HH:MM');
  }

  // MARK: - 2.1: kids mode with a time limit

  var kidsOver = false;

  function checkKidsLimit() {
    var limit = +Prefs.opt('kidsLimit', 0) * 60000;
    if (!Prefs.kids() || !limit) { kidsOver = false; return; }
    var since = +Prefs.opt('kidsSince', 0) || Date.now();
    if (!Prefs.opt('kidsSince', 0)) Prefs.set('kidsSince', since);
    if (Date.now() - since < limit || kidsOver) return;
    kidsOver = true;
    if (saverOn) hideSaver();
    showDialog.icon = 'kids';
    showDialog(tr('Acabou o tempo', 'Time is up', 'Se acabó el tiempo'), [{text: tr('O tempo de TV de hoje terminou. Um adulto pode continuar com o PIN.',
      'Today\'s TV time is over. A grown-up can carry on with the PIN.', 'El tiempo de tele de hoy ha terminado. Un adulto puede seguir con el PIN.')}],
      [{label: tr('Continuar (PIN)', 'Carry on (PIN)', 'Seguir (PIN)'), run: function () {
        askPin(tr('Mais tempo', 'More time', 'Más tiempo'), tr('Digite o PIN.', 'Type the PIN.', 'Escribe el PIN.'), function (d) {
          if (d !== Prefs.kidsPin()) { toast(tr('PIN incorreto', 'Wrong PIN', 'PIN incorrecto')); return; }
          Prefs.set('kidsSince', Date.now());
          kidsOver = false;
          toast(tr('Mais tempo concedido', 'More time given', 'Más tiempo concedido'));
        });
      }}], 0);
  }

  // MARK: - 2.1: time of use, per app, kept only on this TV (the last 30 days)

  var usageOpen = null;

  function usage() { try { return JSON.parse(localStorage.getItem('fmtv.usage')) || {}; } catch (e) { return {}; } }

  /** An app opened from FreeTV: its time runs until FreeTV is on screen again. */
  function usageStart(id) { usageOpen = {id: id, at: Date.now()}; }

  function usageStop() {
    if (!usageOpen) return;
    var open = usageOpen, ms = Math.min(6 * 3600000, Date.now() - open.at), u = usage(), d = dayKey(new Date(open.at));
    usageOpen = null;
    if (ms < 5000) return;
    u[d] = u[d] || {};
    u[d][open.id] = (u[d][open.id] || 0) + ms;
    var days = Object.keys(u).sort();
    while (days.length > 30) delete u[days.shift()];
    try { localStorage.setItem('fmtv.usage', JSON.stringify(u)); } catch (e) {}
  }

  INFO.usage = function () {
    var u = usage(), today = u[dayKey()] || {}, week = {}, rows = [];
    for (var i = 0; i < 7; i++) {
      var d = u[dayKey(new Date(Date.now() - i * 864e5))] || {};
      for (var id in d) if (d.hasOwnProperty(id)) week[id] = (week[id] || 0) + d[id];
    }
    function name(id) { var a = findApp(id); return a ? a.title : id; }
    var t = Object.keys(today).sort(function (a, b) { return today[b] - today[a]; });
    var w = Object.keys(week).sort(function (a, b) { return week[b] - week[a]; });
    if (!w.length) rows.push({label: tr('Ainda nada medido', 'Nothing measured yet', 'Todavía nada medido'), value: '', plain: true});
    t.slice(0, 5).forEach(function (id) { rows.push({label: tr('Hoje · ', 'Today · ', 'Hoy · ') + name(id), value: dur(today[id]), plain: true}); });
    w.slice(0, 8).forEach(function (id) { rows.push({label: tr('7 dias · ', '7 days · ', '7 días · ') + name(id), value: dur(week[id]), plain: true}); });
    rows.push({label: tr('Apagar o histórico', 'Clear the history', 'Borrar el historial'), value: '›', run: function () { try { localStorage.removeItem('fmtv.usage'); } catch (e) {} openInfo('usage'); }});
    return {title: tr('Tempo de uso', 'Time of use', 'Tiempo de uso'), icon: 'timer', rows: rows, visible: 7,
      hint: tr('Contado só nesta TV, desde que uma app é aberta pelo FreeTV até voltar · nada sai da TV', 'Counted only on this TV, from opening an app in FreeTV until coming back · nothing leaves the TV',
        'Contado solo en esta tele, desde que abres una app en FreeTV hasta que vuelves · nada sale de la tele')};
  };

  // MARK: - 2.1: HDMI inputs with a name and on the shelf; shelf and quick panel from any app; recent apps in the drawer

  var INPUT_KINDS = [['', 'HDMI', 'hdmi', ''], ['ps', 'PlayStation', 'gamepad', '#0070D1'], ['xbox', 'Xbox', 'gamepad', '#107C10'], ['switch', 'Nintendo Switch', 'gamepad', '#E60012'],
    ['chromecast', 'Chromecast', 'tv', '#4285F4'], ['appletv', 'Apple TV', 'tv', '#1C1C1E'], ['pc', 'PC', 'tv', '#5B5F6B'], ['tdt', tr('Decodificador', 'Set-top box', 'Decodificador'), 'live_tv', '#7A4DFF'],
    ['bar', tr('Barra de som', 'Soundbar', 'Barra de sonido'), 'speaker', '#3A3D45']];

  function inputKind(id) {
    var k = (Prefs.opt('inputNames', {}) || {})[id] || '';
    for (var i = 0; i < INPUT_KINDS.length; i++) if (INPUT_KINDS[i][0] === k) return INPUT_KINDS[i];
    return INPUT_KINDS[0];
  }

  function inputLabel(x) { var k = inputKind(x.id); return k[0] ? k[1] : (x.label || tr('TV aberta', 'Live TV', 'TV en vivo')); }

  /** The inputs and channels the person put on the shelf, as apps. */
  function extraApps() {
    var out = [], on = Prefs.opt('inputShelf', []) || [];
    inputs.forEach(function (x) {
      if (on.indexOf(x.id) < 0) return;
      var k = inputKind(x.id);
      out.push({id: x.id, title: inputLabel(x), icon: '', color: k[3] || '#3A3F4B', symbol: k[2] || x.symbol || 'hdmi', input: true});
    });
    var chans = Prefs.opt('chanShelf', []) || [];
    allChannels().forEach(function (c) {
      if (chans.indexOf(c.key) >= 0) out.push({id: 'chan:' + c.key, title: c.title, icon: c.thumb || '', color: '#FF0033', chan: c});
    });
    return out;
  }

  INFO.inputs = function () {
    var rows = [], on = Prefs.opt('inputShelf', []) || [];
    inputs.forEach(function (x) {
      if (x.key === 'live') return;
      rows.push({label: (x.label || x.id) + ' →', value: inputKind(x.id)[1], step: function (d) {
        var names = Prefs.opt('inputNames', {}) || {}, i = 0;
        for (var j = 0; j < INPUT_KINDS.length; j++) if (INPUT_KINDS[j][0] === (names[x.id] || '')) i = j;
        names[x.id] = INPUT_KINDS[(i + (d || 1) + INPUT_KINDS.length) % INPUT_KINDS.length][0];
        Prefs.set('inputNames', names);
        reloadExtras();
      }});
      rows.push({label: tr('   na prateleira', '   on the shelf', '   en el estante'), toggle: on.indexOf(x.id) >= 0, step: function () {
        toggleShelf(x.id, on.indexOf(x.id) < 0 ? 'add' : 'remove', 'inputShelf');
      }});
    });
    if (!rows.length) rows.push({label: tr('Nenhuma entrada', 'No inputs', 'Ninguna entrada'), value: '', plain: true});
    return {title: tr('Entradas HDMI', 'HDMI inputs', 'Entradas HDMI'), icon: 'hdmi', rows: rows, visible: 7,
      hint: tr('◀ ▶ o que está ligado · OK na prateleira · Voltar fecha', '◀ ▶ what is plugged in · OK on the shelf · Back closes', '◀ ▶ lo que hay conectado · OK en el estante · Atrás cierra')};
  };

  function reloadExtras() {
    apps = apps.filter(function (a) { return !a.input && !a.chan; }).concat(extraApps());
    Data.setApps(apps);
    pickShelf();
    renderShelf();
    renderDrawer();
  }

  /** Put an app (or an input, or a channel) on the shelf or take it off. list: the extra list it also belongs to. */
  function toggleShelf(id, how, list) {
    if (list) {
      var l = (Prefs.opt(list, []) || []).filter(function (x) { return x !== id && 'chan:' + x !== id; });
      if (how === 'add') l.push(list === 'chanShelf' ? id.replace(/^chan:/, '') : id);
      Prefs.set(list, l);
      reloadExtras();
    }
    var ids = shelf.map(function (a) { return a.id; }), key = list === 'chanShelf' ? id : id;
    if (how === 'add' && ids.indexOf(key) < 0) {
      if (ids.length >= MAX_SHELF) { toast(tr('A prateleira está cheia (12)', 'The shelf is full (12)', 'El estante está lleno (12)')); return; }
      ids.push(key);
    } else if (how === 'remove') ids = ids.filter(function (x) { return x !== key; });
    Prefs.set('shelf', ids);
    pickShelf();
    renderShelf();
    updateFocus();
    toast(how === 'add' ? tr('Na prateleira', 'On the shelf', 'En el estante') : tr('Fora da prateleira', 'Off the shelf', 'Fuera del estante'));
  }

  function quickApps() { var q = Prefs.opt('quickApps', []); return q instanceof Array ? q : []; }

  function toggleQuickApp(app) {
    var q = quickApps().filter(function (x) { return x !== app.id; });
    var adding = q.length === quickApps().length;
    if (adding) q.push(app.id);
    Prefs.set('quickApps', q.slice(-6));
    toast(adding ? tr('No painel rápido', 'In the quick panel', 'En el panel rápido') : tr('Fora do painel rápido', 'Off the quick panel', 'Fuera del panel rápido'));
  }

  // MARK: - 2.1: backups of the settings: on the TV's store service, and to a file through the computer

  function restoreBackup() {
    svcCall('prefsLoad', {}, function (r) {
      var data = r && r.returnValue && r.data;
      if (!data || !data['fmtv.prefs']) { toast(tr('Não há cópia guardada', 'There is no saved copy', 'No hay copia guardada')); return; }
      for (var k in data) if (data.hasOwnProperty(k) && /^fmtv\./.test(k)) { try { localStorage.setItem(k, data[k]); } catch (e) {} }
      toast(tr('Cópia restaurada', 'Copy restored', 'Copia restaurada'));
      setTimeout(function () { location.reload(); }, 800);
    });
  }

  // MARK: - Keys

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    // 1537: what the TV sends when its screen comes back from LG's screensaver (and FreeTV sends that one away): not a person.
    if (k === 1537) return;
    if (poke()) { e.preventDefault(); return; }   // the first press only wakes the screen
    if (sleep.warning) { sleepCancel(); e.preventDefault(); return; }   // any key keeps the TV on
    if (pin.on) {
      if (pinKey(k)) { e.preventDefault(); return; }
      if (k === TV.keys.back || k === 27) { pin.on = false; closeDialog(); e.preventDefault(); return; }
    }
    var field = document.activeElement && document.activeElement.tagName === 'INPUT' ? document.activeElement : null;
    if (field) {
      // Typing with the TV's keyboard: the letters go to the field; Enter searches; Back or the arrows leave the field.
      if (k === 13) { e.preventDefault(); field.blur(); if (field.onEnter) field.onEnter(field.value); }
      else if (k === TV.keys.back || k === 27 || k === TV.keys.up || k === TV.keys.down) { e.preventDefault(); field.blur(); }
      return;
    }
    if (shortcutKey(k)) { e.preventDefault(); return; }
    if (k === TV.keys.ok && (st.zone === Z.SHELF || holdMenu())) {
      // Here OK acts when it is released, so that holding it can pick the app up (shelf) or open the menu (Custom, Continue watching, All Apps).
      e.preventDefault();
      if (!okDown) {
        okDown = true;
        okHeld = false;
        if (grabbed >= 0) { okHeld = true; drop(); return; }
        clearTimeout(okTimer);
        if (st.zone === Z.SHELF) { if (!Prefs.kids()) okTimer = setTimeout(function () { okHeld = true; grab(st.shelf); }, OK_HOLD); }
        else okTimer = setTimeout(function () { var open = holdMenu(); okHeld = true; if (open) open(); }, OK_HOLD);
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
    if (pressed && !held && (st.zone === Z.SHELF || holdMenu()) && grabbed < 0) activate();
  });
  // Chrome sends a mousemove again, at the same place, whenever the page under a parked pointer changes (every refresh of the cards):
  // that is not a person, and it kept the screensaver from ever starting. Only a pointer that moved wakes the screen.
  var lastMouse = '';
  document.addEventListener('mousemove', function (e) {
    var at = e.screenX + ',' + e.screenY + ',' + e.clientX + ',' + e.clientY;
    if (at === lastMouse) return;
    lastMouse = at;
    poke();
  });

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
        apps = list.concat(extraApps());   // inputs and channels the person put on the shelf
        Data.setApps(apps);
        pickShelf();
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
    if (st.tab !== firstTab()) { st.tab = firstTab(); renderCards(); }
    updateFocus();
  }

  Data.onChange(function () {
    checkBuiltinAlerts();
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
  var hiddenAt = 0, hiddenTimer = 0;
  document.addEventListener('visibilitychange', function () {
    clearTimeout(hiddenTimer);
    if (document.hidden) {
      // LG's clock can hide FreeTV for a moment while ours is on: keep ours (and the watcher that sends LG's away) for a while.
      hiddenAt = Date.now();
      if (saverOn) hiddenTimer = setTimeout(function () { if (document.hidden) hideSaver(); }, 5 * 60000);
      else hideSaver();
      return;
    }
    watchLgSaver();
    usageStop();
    if (saverOn && Date.now() - hiddenAt < 5 * 60000) return;   // back from LG's clock: ours goes on
    idleAt = Date.now();
    loadApps(function () { renderShelf(); renderDrawer(); updateFocus(); Data.refresh(); });
    askScreen();
  });

  // Keeping LG's screensaver (the clock) away from ours needs the TV's yes once. It is asked here, a few seconds after FreeTV is
  // on screen and someone is using it, never when the screensaver starts (nobody would answer).
  /** LG's clock may start before ours (both after about two minutes): then ours comes up instead. "Never" leaves LG's alone. */
  function watchLgSaver() {
    if (TV.name !== 'webos' || !TV.canHoldScreen()) return;
    TV.watchScreen(function () {
      if (!saverOn && (document.hidden || !+Prefs.opt('saverAfter', 2))) return false;
      if (!saverOn) showSaver();
      return true;
    });
  }

  function askScreen() {
    if (TV.name !== 'webos' || TV.canHoldScreen()) return;
    setTimeout(function () { if (!document.hidden && !saverOn) TV.pairScreen(function (ok) { if (ok) watchLgSaver(); }); }, 6000);
  }
  askScreen();
  watchLgSaver();

  I18N.set(Prefs.language());
  fit();
  applyLook();
  renderTop();
  var openedForStore = takeStoreHost(window.PalmSystem && window.PalmSystem.launchParams);   // started by `community.py serve`
  loadApps(function () {
    renderAll();
    Data.refresh();
    if (openedForStore) openCommunity();
  });
  // The settings are kept in two places: this page's storage, which a reinstall of FreeTV empties, and the store service's folder, which a
  // reinstall keeps. A copy goes there a few seconds after a change; an empty page asks for it back once.
  var SAVED_KEYS = ['fmtv.prefs', 'fmtv.devApps', 'fmtv.ssapKey', 'fmtv.ssapPowerKey2', 'fmtv.ssapRefused', 'fmtv.ssapPowerRefused', 'fmtv.usage'], savedLast = '', saveTimer = 0;

  function snapshot() {
    var out = {}, any = false;
    SAVED_KEYS.forEach(function (k) { try { var v = localStorage.getItem(k); if (v !== null) { out[k] = v; any = true; } } catch (e) {} });
    return any && out['fmtv.prefs'] !== undefined ? out : null;
  }

  var restorePending = false;   // a fresh page must not save its own empty settings over the copy it is about to ask for

  function saveSettings() {
    clearTimeout(saveTimer);
    var data = snapshot();
    if (!data || TV.name !== 'webos') return;
    if (restorePending) { saveTimer = setTimeout(saveSettings, 15000); return; }
    var text = JSON.stringify(data);
    if (text === savedLast) return;
    svcCall('prefsSave', {data: data}, function (r) { if (r && r.returnValue) savedLast = text; });
  }

  window.onPrefsChanged = function () { clearTimeout(saveTimer); saveTimer = setTimeout(saveSettings, 6000); };

  function restoreSettings() {
    var done = !freshInstall;
    try { done = done || sessionStorage.getItem('fmtv.restored') === '1'; } catch (e) { done = true; }
    if (done || TV.name !== 'webos') return;
    restorePending = true;
    svcCall('prefsLoad', {}, function (r) {
      var data = r && r.returnValue && r.data;
      restorePending = false;
      if (!data || !data['fmtv.prefs']) { if (freshInstall) setTimeout(startOnboarding, 1500); return; }
      try {
        // What this page wrote on its own meanwhile (the Store's icon, say) stays under what the person had chosen.
        var mine = JSON.parse(localStorage.getItem('fmtv.prefs') || '{}'), saved = JSON.parse(data['fmtv.prefs']), k;
        for (k in saved) if (Object.prototype.hasOwnProperty.call(saved, k)) mine[k] = saved[k];
        localStorage.setItem('fmtv.prefs', JSON.stringify(mine));
        SAVED_KEYS.forEach(function (key) { if (key !== 'fmtv.prefs' && typeof data[key] === 'string' && !localStorage.getItem(key)) localStorage.setItem(key, data[key]); });
        sessionStorage.setItem('fmtv.restored', '1');
      } catch (e) { return; }
      location.reload();
    });
  }
  restoreSettings();
  if (TV.name === 'webos') setInterval(saveSettings, 10 * 60 * 1000);   // also picks up the keys of the TV's remote API and the app list

  // Wake the store service now, so the first visit to the Store does not wait for its cold start (about 30 s on the TV).
  if (TV.name === 'webos') {
    setTimeout(function () { svcCall('status', {}, function () {}); }, 20000);
    setTimeout(autoUpdate, 90000);
    setTimeout(devAuto, 120000);
    setTimeout(function () { versionCheck(); }, 180000);
    setTimeout(function () { privacyCheck(function () { if (st.zone === Z.SETTINGS) renderSettings(); }); }, 150000);
    setInterval(function () { if (Date.now() - dev.at > 6 * 3600 * 1000) devAuto(); }, 1800 * 1000);
    setInterval(autoUpdate, 3600 * 1000);   // it only acts when a day has passed since the last time
  }

  setInterval(function () { if (Prefs.wallpaper() === 'places') backdrop(bgFor('')); }, 600000);   // a new landscape every half hour
  setInterval(function () {
    renderClock();
    checkNight();
    Data.refresh();
    if (saverOn) tickSaverClock($('saver').querySelector('.clock'));
    checkRoutines();
    checkReminders();
    checkKidsLimit();
    if (++ticks % 10 === 0) refreshTickers();
  }, 30000);
  var ticks = 0;
  setTimeout(refreshTickers, 8000);
  setInterval(function () {   // looked at often, so it starts at 2 minutes and not up to 30 seconds late
    var after = +Prefs.opt('saverAfter', 2) * 60000;   // 0: never
    if (after && !saverOn && !sheetOpen() && Date.now() - idleAt > after) showSaver();
  }, 5000);

  // For the browser preview and tests.
  window.FreeMyTV = {state: st, move: move, activate: activate, back: back, showSaver: showSaver, hideSaver: hideSaver, toast: toast,
    grab: grab, drop: drop, shelf: function () { return shelf; }, settingsChanged: function () { if (st.zone === Z.SETTINGS) renderSettings(); }, openApps: openApps, openTiles: openTiles, openSearch: openSearch, openInfo: openInfo, runAction: runAction, apps: function () { return others; }};
})();
