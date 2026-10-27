/*
 * The TV's side of the web home screen: its apps, opening one, its inputs, its settings, the Back key, its time zone.
 *  - LG webOS: the TV's service bus (Luna), the same calls LG's launcher makes.
 *  - Samsung Tizen: Tizen's web APIs (tizen.application for the apps, tizen.tvwindow for the inputs).
 *  - A desktop browser: a stand-in with sample apps, so the screen can be previewed and tested on a computer.
 * Plain ES5: older TVs run a Chromium from 2015-2017 (webOS 3 and 4, Tizen 3).
 */
var TV = (function () {
  'use strict';

  var webos = typeof window.PalmServiceBridge !== 'undefined';
  var samsung = !webos && typeof window.tizen !== 'undefined' && !!window.tizen.application;
  var calls = [];   // a bridge is collected if nothing holds it before its reply arrives

  /** One Luna call; done(result) with null on failure. */
  function luna(uri, params, done) {
    if (!webos) {
      if (done) setTimeout(function () { done(null); }, 0);
      return;
    }
    var bridge = new window.PalmServiceBridge();
    calls.push(bridge);
    var finished = false;
    bridge.onservicecallback = function (message) {
      if (finished) return;
      finished = true;
      var i = calls.indexOf(bridge);
      if (i >= 0) calls.splice(i, 1);
      var result = null;
      try { result = JSON.parse(message); } catch (e) {}
      if (done) done(result && result.returnValue !== false ? result : null);
    };
    bridge.call(uri, JSON.stringify(params || {}));
  }

  // webOS 6 gives Developer Mode apps only the "public" group, which leaves out listLaunchPoints. There the list comes
  // from the TV's remote control API on 127.0.0.1:3000 (the one LG's phone app uses), which takes file:// pages.
  // The TV asks once to allow it; the key it gives back is kept.
  var SSAP_KEY = 'fmtv.ssapKey', SSAP_REFUSED = 'fmtv.ssapRefused';

  // A "no" on the TV's prompt is kept for three days; a prompt nobody answered (or any other error) only for an hour. Older
  // versions kept any error for ever (value '1'): that is forgotten.
  function refused(name) {
    var at = 0;
    try { at = +localStorage.getItem(name) || 0; } catch (e) {}
    return at > 1 && Date.now() < at;
  }
  function refuse(name, m) {
    var said = /deni|reject/i.test(JSON.stringify((m && (m.error || m.payload)) || ''));
    try { localStorage.setItem(name, String(Date.now() + (said ? 3 * 864e5 : 36e5))); } catch (e) {}
  }

  /** One call to the remote control API; done(result) with null on failure. */
  function ssap(uri, done) {
    var ws = null, finished = false, key = null;
    var timer = setTimeout(function () { finish(null); }, 90000);   // time to answer the TV's prompt
    function finish(result) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { ws.close(); } catch (e) {}
      done(result);
    }
    try { key = localStorage.getItem(SSAP_KEY); } catch (e) {}
    try { ws = new WebSocket('ws://127.0.0.1:3000'); } catch (e) { finish(null); return; }
    ws.onopen = function () {
      var payload = {forcePairing: false, pairingType: 'PROMPT',
        manifest: {manifestVersion: 1, appVersion: '1.0', permissions: ['READ_INSTALLED_APPS']}};
      if (key) payload['client-key'] = key;
      ws.send(JSON.stringify({type: 'register', id: 'register', payload: payload}));
    };
    ws.onmessage = function (event) {
      var m = null;
      try { m = JSON.parse(event.data); } catch (e) {}
      if (!m) return;
      if (m.type === 'registered') {
        try { localStorage.setItem(SSAP_KEY, m.payload['client-key']); } catch (e) {}
        ws.send(JSON.stringify({type: 'request', id: 'call', uri: 'ssap://' + uri}));
      } else if (m.id === 'call' || m.type === 'error') {
        if (m.id === 'register' && m.type === 'error') {
          refuse(SSAP_REFUSED, m);
        }
        finish(m.type !== 'error' && m.payload && m.payload.returnValue !== false ? m.payload : null);
      }
    };
    ws.onerror = ws.onclose = function () { finish(null); };
  }

  // LG's own screensaver (the clock) starts after its idle time and goes over FreeTV's, whatever FreeTV does: the TV's power state turns to
  // "Screen Saver". The remote control API can read that state and turn the screen on again, which sends LG's screensaver away. It asks
  // the TV once to allow it (power state and screen: turnOnScreen needs more than CONTROL_POWER); the key it gives back is kept.
  // It is asked when FreeTV opens (powerPair), while someone is looking: asked when the screensaver starts, nobody answered it.
  var POWER_KEY = 'fmtv.ssapPowerKey2', POWER_REFUSED = 'fmtv.ssapPowerRefused';
  var power = {on: false, ws: null, timer: 0, retry: 0, pairing: false};
  var POWER_MANIFEST = {manifestVersion: 1, appVersion: '1.0', permissions: ['READ_POWER_STATE', 'CONTROL_POWER', 'CONTROL_TV_SCREEN', 'CONTROL_DISPLAY']};

  function powerKey() {
    try { return localStorage.getItem(POWER_KEY); } catch (e) { return null; }
  }

  /** Asks the TV for the power permission when FreeTV has none yet; done(ok). The TV shows its prompt (up to 90 seconds to answer). */
  function powerPair(done) {
    done = done || function () {};
    if (!webos || power.pairing) { done(false); return; }
    if (powerKey()) { done(true); return; }
    if (refused(POWER_REFUSED)) { done(false); return; }
    power.pairing = true;
    var ws = null, finished = false;
    var timer = setTimeout(function () { finish(false, null); }, 90000);
    function finish(ok, m) {
      if (finished) return;
      finished = true;
      power.pairing = false;
      clearTimeout(timer);
      if (!ok) refuse(POWER_REFUSED, m);
      try { ws.close(); } catch (e) {}
      done(ok);
    }
    try { ws = new WebSocket('ws://127.0.0.1:3000'); } catch (e) { finish(false, null); return; }
    ws.onopen = function () {
      ws.send(JSON.stringify({type: 'register', id: 'register', payload: {forcePairing: false, pairingType: 'PROMPT', manifest: POWER_MANIFEST}}));
    };
    ws.onmessage = function (event) {
      var m = null;
      try { m = JSON.parse(event.data); } catch (e) {}
      if (!m) return;
      if (m.type === 'registered') {
        try { localStorage.setItem(POWER_KEY, m.payload['client-key']); localStorage.removeItem(POWER_REFUSED); } catch (e) {}
        finish(true, m);
      } else if (m.id === 'register' && m.type === 'error') finish(false, m);
    };
    ws.onerror = function () { finish(false, null); };
  }

  function powerStop() {
    power.on = false;
    clearTimeout(power.timer);
    clearTimeout(power.retry);
    try { if (power.ws) power.ws.close(); } catch (e) {}
    power.ws = null;
  }

  function powerStart() {
    if (!webos || power.on) return;
    var key = powerKey();
    if (!key) return;   // no prompt while the screensaver is on: nobody is there to answer it (powerPair asks)
    power.on = true;
    var ws = null;
    function send(id, uri) { try { ws.send(JSON.stringify({type: 'request', id: id, uri: 'ssap://' + uri})); } catch (e) {} }
    function ask() {
      if (!power.on || power.ws !== ws) return;
      send('state', 'com.webos.service.tvpower/power/getPowerState');
      power.timer = setTimeout(ask, 1500);
    }
    function again() {
      if (!power.on || power.ws !== ws) return;
      clearTimeout(power.timer);
      power.ws = null;
      power.retry = setTimeout(function () { if (power.on) { power.on = false; powerStart(); } }, 20000);
    }
    try { ws = new WebSocket('ws://127.0.0.1:3000'); } catch (e) { power.on = false; return; }
    power.ws = ws;
    ws.onopen = function () {
      ws.send(JSON.stringify({type: 'register', id: 'register', payload: {forcePairing: false, pairingType: 'PROMPT', manifest: POWER_MANIFEST, 'client-key': key}}));
    };
    ws.onmessage = function (event) {
      var m = null;
      try { m = JSON.parse(event.data); } catch (e) {}
      if (!m) return;
      if (m.type === 'registered') {
        try { localStorage.setItem(POWER_KEY, m.payload['client-key']); } catch (e) {}
        ask();
      } else if (m.id === 'register' && m.type === 'error') {
        try { localStorage.removeItem(POWER_KEY); } catch (e) {}   // the TV forgot this key: powerPair asks again next time FreeTV opens
        powerStop();
      } else if (m.id === 'state' && m.payload && m.payload.state && m.payload.state !== 'Active') {
        send('wake', 'com.webos.service.tvpower/power/turnOnScreen');   // LG's screensaver took over: send it away
      }
    };
    ws.onerror = ws.onclose = again;
  }

  // LG inputs: the antenna and the four HDMI ports, with the apps LG opens for them.
  var INPUTS = [
    {id: 'com.webos.app.livetv', key: 'live', label: null, symbol: 'live_tv'},
    {id: 'com.webos.app.hdmi1', key: 'hdmi1', label: 'HDMI 1', symbol: 'hdmi'},
    {id: 'com.webos.app.hdmi2', key: 'hdmi2', label: 'HDMI 2', symbol: 'hdmi'},
    {id: 'com.webos.app.hdmi3', key: 'hdmi3', label: 'HDMI 3', symbol: 'hdmi'},
    {id: 'com.webos.app.hdmi4', key: 'hdmi4', label: 'HDMI 4', symbol: 'hdmi'}
  ];

  // Not shown among LG's apps: the inputs above, LG's own home and launchers.
  var HIDDEN = /^(com\.webos\.app\.(livetv|hdmi\d|home|homeconnect|discovery|launcher)|com\.webos\.app\.inputpicker|com\.local\.nativehome|io\.freemytv|com\.gathin\.tvhome[\w.]*)$/;

  // Not shown among Samsung's apps: Smart Hub's own pieces, the platform's tools and players (but its browser and
  // Netflix, which live there too), services, keyboards and ad players. The rest is what Smart Hub shows.
  // Tizen 4 also lists Samsung's own pieces: the YouTube engine's hosts (cobalt-*: "App", "Youtube", "YoutubeTV"),
  // Bixby, search, previews, the weather and notification popups, Apple TV's stand-in and engine.
  var SAMSUNG_HIDDEN = new RegExp('^(org\\.volt\\.|org\\.tizen\\.(?!browser$|netflix)|org\\.tizen\\.netflixlowmem$|ise-|ug-|d75857a5-)' +
      '|[Ss]ervice$|[Dd]aemon|Preview$|syspopup|[Hh]elper$|AdPlayer|AdSuite|[Kk]eyboard|\\.OTApp$' +
      '|^com\\.samsung\\.(calendar-account-manager|tv\\.(cobalt-|aria-(dummy|engine)|airplay-app|ambient-support|' +
      'built-in-app-info-viewer|commonsearch|searchall|preview-|tv-scheduler|csfs|notification-app|mycontents|' +
      'safLaunchBridge|shortcut|remote-workspace|voiceassistant|mybixby|weather-viewer))');

  // Samsung apps whose iconPath is Tizen's generic pinwheel (a valid image, so onerror never fires): our own icons.
  // Seen on a 2018 NU7675 (Tizen 4); Smart Hub draws their real icons from a folder apps can't read. On a 2017
  // MU6100 (Tizen 3) no iconPath loads at all, so common apps get a logo here: Simple Icons' (CC0), cropped and tinted
  // for the tiles, with a width and height so old WebKit sizes them like PNGs.
  var SAMSUNG_ICONS = {
    '9Ur5IzDKqV.TizenYouTube': 'icons/youtube.png',
    'evKhCgZelL.AmazonIgnitionLauncher2': 'icons/prime.png',
    'RN1MCdNq8t.Netflix': 'icons/netflix.svg',
    'org.tizen.netflix-app': 'icons/netflix.svg',
    'NvZ26VG9Yw.HBOGOLAG': 'icons/max.svg',
    'rJeHak5zRg.Spotify': 'icons/spotify.svg',
    'cexr1qp97S.Deezer': 'icons/deezer.svg',
    '5SLwh7m3En.TizenYouTubeKids': 'icons/youtubekids.svg',
    '4OAwqypfRT.RedBullTV': 'icons/redbull.svg',
    'UCJa2s9hhC.TED': 'icons/ted.svg',
    'QizQxC7CUf.PlayMovies': 'icons/googleplay.svg',
    'vIutycUzou.SteamLink': 'icons/steam.svg',
    'geUOM7qimf.FOXPlay': 'icons/fox.svg'
  };

  // Names Smart Hub gets wrong: HBO's app has none (so it never reached the shelf), others are long or old.
  var SAMSUNG_TITLES = {
    'NvZ26VG9Yw.HBOGOLAG': 'Max',
    'rJeHak5zRg.Spotify': 'Spotify',
    'evKhCgZelL.AmazonIgnitionLauncher2': 'Prime Video'
  };

  // Samsung's settings menu on Tizen 3, which answers no "settings" app control.
  var SAMSUNG_MENU = 'org.tizen.menu';

  // Samsung's live TV viewer: it shows whichever source the TV is on (the antenna, or the HDMI picked here).
  var SAMSUNG_VIEWER = 'org.tizen.tv-viewer';

  var SAMPLE = [
    ['netflix', 'Netflix', '#E50914'], ['youtube.leanback.v4', 'YouTube', '#FF0033'], ['amazon', 'Prime Video', '#1A98FF'],
    ['com.disney.disneyplus-prod', 'Disney+', '#1838C8'], ['com.hbo.hbomax', 'Max', '#6C3BE0'],
    ['com.apple.appletv', 'Apple TV', '#B8BCC6'], ['globoplaywebos', 'Globoplay', '#FF5A1F'], ['spotify-beehive', 'Spotify', '#1DB954'],
    ['cdp-30', 'Plex', '#E5A00D'], ['com.crunchyroll.webapp', 'Crunchyroll', '#F47521'], ['com.webos.app.browser', 'Web Browser', '#3A7BD5'],
    ['com.palm.app.settings', 'Settings', '#8E8E93']
  ];

  // Newer webOS (11 tested) denies listLaunchPoints to Developer Mode apps, but still answers getAppLoadStatus for
  // one app id: these are checked one by one there. Their icons can't be read, so the shelf shows their names.
  var KNOWN = [
    ['netflix', 'Netflix'], ['youtube.leanback.v4', 'YouTube'], ['amazon', 'Prime Video'],
    ['com.disney.disneyplus-prod', 'Disney+'], ['com.wbd.stream', 'HBO Max'], ['com.hbo.hbomax', 'Max'],
    ['com.apple.appletv', 'Apple TV'], ['hulu', 'Hulu'], ['com.peacock.tv', 'Peacock'], ['com.nfl.app', 'NFL'],
    ['globoplaywebos', 'Globoplay'], ['spotify-beehive', 'Spotify'], ['tv.twitch.tv.starshot.lg', 'Twitch'],
    ['cdp-30', 'Plex'], ['com.crunchyroll.webapp', 'Crunchyroll'], ['com.webos.app.browser', 'Web Browser']
  ];

  /** The apps the installer read from the TV (apps.js: id, title, icon file), as the home lists them. */
  function staticApps() {
    var data = window.TV_APPS, out = [];
    if (!data || !data.apps) return out;
    for (var i = 0; i < data.apps.length; i++) {
      var a = data.apps[i];
      if (!a.id || a.id === self || HIDDEN.test(a.id)) continue;
      out.push({id: a.id, title: a.title || a.id, icon: a.icon || '', color: a.iconColor || ''});
    }
    // Apps installed from FreeTV's own store since the list was read (the store service keeps them in localStorage).
    var extra = [];
    try { extra = JSON.parse(localStorage.getItem('fmtv.devApps')) || []; } catch (e) {}
    for (var j = 0; j < extra.length; j++) {
      var x = extra[j], known = false;
      if (!x || !x.id || x.id === self || HIDDEN.test(x.id)) continue;
      for (var k = 0; k < out.length; k++) if (out[k].id === x.id) known = true;
      if (!known) out.push({id: x.id, title: x.title || x.id, icon: x.icon || '', color: x.color || ''});
    }
    return out;
  }

  function fallbackApps(done) {
    var list = staticApps();
    if (list.length) done(list); else knownApps(done);
  }

  function knownApps(done) {
    var found = [], left = KNOWN.length, sent = false;
    function finish() {
      if (sent) return;
      sent = true;
      done(found.filter(function (x) { return x; }));
    }
    setTimeout(finish, 5000);   // an id that never answers doesn't hold the rest
    KNOWN.forEach(function (k, i) {
      luna('luna://com.webos.applicationManager/getAppLoadStatus', {appId: k[0]}, function (res) {
        if (res && res.exist) found[i] = {id: k[0], title: k[1], icon: '', color: ''};
        if (--left === 0) finish();
      });
    });
  }

  var self = 'io.freemytv';
  if (webos && window.PalmSystem && window.PalmSystem.identifier) self = window.PalmSystem.identifier.split(' ')[0];
  if (samsung) {
    try { self = window.tizen.application.getCurrentApplication().appInfo.id; } catch (e) {}
  }

  // MARK: - Samsung

  function samsungApps(done) {
    try {
      window.tizen.application.getAppsInfo(function (list) {
        var out = [];
        for (var i = 0; i < list.length; i++) {
          var a = list[i];
          if (!a.id || a.show === false || a.id === self || SAMSUNG_HIDDEN.test(a.id)) continue;
          var icon = a.iconPath || '';
          if (icon && icon.indexOf('://') < 0) icon = 'file://' + icon;
          if (SAMSUNG_ICONS[a.id]) icon = SAMSUNG_ICONS[a.id];
          out.push({id: a.id, title: SAMSUNG_TITLES[a.id] || a.name || a.id, icon: icon, color: ''});
        }
        // The built-in Netflix stays only when the store's Netflix isn't installed.
        var store = out.some(function (x) { return /\.Netflix$/.test(x.id); });
        if (store) out = out.filter(function (x) { return x.id.indexOf('org.tizen.netflix') !== 0; });
        // Smart Hub keeps its own order, which isn't readable: the same alphabetical order as All Apps elsewhere.
        out.sort(function (x, y) { var a = x.title.toLowerCase(), b = y.title.toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; });
        done(out);
      }, function () { done([]); });
    } catch (e) {
      done([]);
    }
  }

  // Samsung's YouTube: the Tizen app, and the id older TVs give it.
  var SAMSUNG_YOUTUBE = /(\.TizenYouTube|^111299001912)$/;

  function samsungLaunch(id, params, done) {
    function plain() {
      try {
        window.tizen.application.launch(id, function () { if (done) done(true); }, function () { if (done) done(false); });
      } catch (e) {
        if (done) done(false);
      }
    }
    // A video in Samsung's YouTube ("v=VIDEOID", what the Custom tab passes as contentTarget): the "view" request with the
    // video in its PAYLOAD, the way Samsung's YouTube takes a video from outside. If this TV doesn't take it, YouTube just opens.
    // Not tried on a Samsung by us.
    var target = params && params.contentTarget;
    if (target && SAMSUNG_YOUTUBE.test(id)) {
      try {
        var data = new window.tizen.ApplicationControlData('PAYLOAD', [JSON.stringify({values: target})]);
        var control = new window.tizen.ApplicationControl('http://tizen.org/appcontrol/operation/view', null, null, null, [data]);
        window.tizen.application.launchAppControl(control, id, function () { if (done) done(true); }, plain);
        return;
      } catch (e) { /* this Tizen has no such request: plain launch */ }
    }
    plain();
  }

  /** The video sources the TV reports ([{type: 'TV' | 'HDMI' | ..., number}]), or null when it doesn't tell. */
  function samsungSources(done) {
    try {
      window.tizen.systeminfo.getPropertyValue('VIDEOSOURCE', function (v) { done(v && v.connected ? v.connected : null); },
          function () { done(null); });
    } catch (e) {
      done(null);
    }
  }

  /** Puts the TV on a source ("source:HDMI:2"), then brings the TV's viewer up to show it. */
  function samsungSource(spec, done) {
    var parts = spec.split(':'), type = parts[1], number = +parts[2];
    function show(ok) {
      if (!ok) { if (done) done(false); return; }
      samsungLaunch(SAMSUNG_VIEWER, function (shown) {
        if (!shown) {
          try { window.tizen.application.getCurrentApplication().hide(); } catch (e) {}
        }
        if (done) done(true);
      });
    }
    samsungSources(function (sources) {
      var source = null;
      for (var i = 0; sources && i < sources.length; i++) {
        if (sources[i].type === type && sources[i].number === number) source = sources[i];
      }
      if (!source) { show(type === 'TV'); return; }   // the antenna: the viewer alone brings it up
      try {
        window.tizen.tvwindow.setSource(source, function () { show(true); }, function () { show(false); });
      } catch (e) {
        show(false);
      }
    });
  }

  function samsungInputs(done) {
    var list = [{id: 'source:TV:1', key: 'live', label: null, symbol: 'live_tv', connected: true}];
    for (var n = 1; n <= 4; n++) list.push({id: 'source:HDMI:' + n, key: 'hdmi' + n, label: 'HDMI ' + n, symbol: 'hdmi', connected: true});
    samsungSources(function (sources) {
      if (sources) {
        for (var i = 1; i < list.length; i++) list[i].connected = false;
        for (var j = 0; j < sources.length; j++) {
          var s = sources[j];
          if (s.type === 'HDMI' && s.number >= 1 && s.number <= 4) list[s.number].connected = true;
        }
      }
      done(list);
    });
  }

  /** Samsung's settings: whichever app answers the platform's "settings" request, else the TV's menu (Tizen 3). */
  function samsungSettings(done) {
    function menu() { samsungLaunch(SAMSUNG_MENU, done); }
    try {
      var control = new window.tizen.ApplicationControl('http://tizen.org/appcontrol/operation/setting', null, null, null, []);
      window.tizen.application.launchAppControl(control, null, function () { if (done) done(true); }, menu);
    } catch (e) {
      menu();
    }
  }

  // MARK: - The TV, whichever it is

  return {
    name: webos ? 'webos' : samsung ? 'tizen' : 'browser',

    /** The YouTube app the Custom tab opens its channels in: YouTube AdFree on LG (it takes LG's YouTube id), Samsung's own YouTube. */
    youtube: samsung ? ['9Ur5IzDKqV.TizenYouTube', '111299001912'] : ['youtube.leanback.v4'],

    /** Puts the TV in standby (the sleep timer), through the remote control API; done(ok). */
    turnOff: function (done) {
      if (!webos) { if (done) done(false); return; }
      var ws = null, over = false, key = null;
      function finish(ok) { if (over) return; over = true; try { ws.close(); } catch (e) {} if (done) done(ok); }
      try { key = localStorage.getItem(POWER_KEY); } catch (e) {}
      try { ws = new WebSocket('ws://127.0.0.1:3000'); } catch (e) { finish(false); return; }
      setTimeout(function () { finish(false); }, 15000);
      ws.onopen = function () {
        var payload = {forcePairing: false, pairingType: 'PROMPT',
          manifest: {manifestVersion: 1, appVersion: '1.0', permissions: ['READ_POWER_STATE', 'CONTROL_POWER', 'CONTROL_TV_SCREEN', 'CONTROL_DISPLAY']}};
        if (key) payload['client-key'] = key;
        ws.send(JSON.stringify({type: 'register', id: 'register', payload: payload}));
      };
      ws.onmessage = function (event) {
        var m = null;
        try { m = JSON.parse(event.data); } catch (e) {}
        if (!m) return;
        if (m.type === 'registered') ws.send(JSON.stringify({type: 'request', id: 'off', uri: 'ssap://system/turnOff'}));
        else if (m.id === 'off') finish(m.type !== 'error');
        else if (m.id === 'register' && m.type === 'error') finish(false);
      };
      ws.onerror = ws.onclose = function () { finish(false); };
    },

    /** While FreeTV's screensaver is on (true), LG's own is kept away; false when it ends. */
    holdScreen: function (on) { if (on) powerStart(); else powerStop(); },

    /** Asks once, while someone is looking, for what holdScreen needs; done(ok). */
    pairScreen: powerPair,

    /** Whether holdScreen can keep LG's screensaver away (the TV has allowed it). */
    canHoldScreen: function () { return webos && !!powerKey(); },

    /** Installed apps, as the TV's launcher lists them: [{id, title, icon, color}]; on LG, Live TV is one more; on Samsung with
        TizenBrew, its YouTube AdFree and Twitch AdFree modules ("tizenbrew:npm/<package>"). Both get FreeTV's Store icon. */
    apps: function (done) {
      this.appsOnly(function (list) {
        if (webos) {
          list.push({id: 'com.webos.app.livetv', title: tr('TV em direto', 'Live TV', 'TV en directo'), icon: '', color: '#1C7BFF', symbol: 'live_tv'});
          // FreeTV's own store (Community apps): an icon like any other, which opens that screen instead of an app.
          list.push({id: 'freetv.store', title: tr('Loja', 'Store', 'Tienda'), icon: '', color: '#FF4D79', symbol: 'apps'});
        }
        if (samsung && window.TizenBrew) {
          // With TizenBrew on the TV: YouTube AdFree and Twitch AdFree (its modules) are apps like any other, and FreeTV's Store
          // icon opens the community modules (tizenbrew.js). Without it, the Store icon explains how to get TizenBrew.
          if (window.TizenBrew.installed(list)) {
            window.TizenBrew.RECOMMENDED.forEach(function (m) {
              if (m.shelf) list.push({id: 'tizenbrew:' + m.full, title: m.title, icon: m.icon, color: ''});
            });
          }
          list.push({id: 'freetv.store', title: tr('Loja', 'Store', 'Tienda'), icon: '', color: '#FF4D79', symbol: 'apps'});
        }
        done(list);
      });
    },

    appsOnly: function (done) {
      if (samsung) { samsungApps(done); return; }
      if (!webos) {
        done(SAMPLE.map(function (s) { return {id: s[0], title: s[1], icon: '', color: s[2]}; }));
        return;
      }
      function list(res) {
        var out = [];
        var points = res && res.launchPoints ? res.launchPoints : [];
        for (var i = 0; i < points.length; i++) {
          var p = points[i];
          if (!p.id || p.id === self || HIDDEN.test(p.id)) continue;
          out.push({id: p.id, title: p.title || p.id, icon: p.largeIcon || p.icon || '', color: p.bgColor || p.iconColor || ''});
        }
        return out;
      }
      luna('luna://com.webos.applicationManager/listLaunchPoints', {}, function (res) {
        if (res) { done(list(res)); return; }
        // Denied to Developer Mode apps (webOS 6 and newer): once the TV has allowed the remote control API, it lists
        // every app with its icon; until then, the known apps the TV says it has, while the TV asks once (an answer
        // only counts from the next load on, and a "no" isn't asked again).
        var paired = false, no = false;
        try { paired = !!localStorage.getItem(SSAP_KEY); } catch (e) {}
        no = refused(SSAP_REFUSED);
        if (paired) {
          ssap('com.webos.applicationManager/listLaunchPoints', function (res2) {
            if (res2) done(list(res2)); else fallbackApps(done);
          });
          return;
        }
        if (staticApps().length) { fallbackApps(done); return; }   // no prompt on the TV when the list is already here
        knownApps(done);
        if (!no) ssap('com.webos.applicationManager/listLaunchPoints', function () {});
      });
    },

    /** Opens an app (or an input); done(ok). */
    launch: function (id, params, done) {
      if (samsung) {
        if (id.indexOf('tizenbrew:') === 0) window.TizenBrew.launch(id.slice(10), done);
        else if (id.indexOf('source:') === 0) samsungSource(id, done);
        else samsungLaunch(id, params, done);
        return;
      }
      if (!webos) {
        if (done) setTimeout(function () { done(true); }, 0);
        return;
      }
      luna('luna://com.webos.applicationManager/launch', params ? {id: id, params: params} : {id: id}, function (res) {
        if (done) done(!!res);
      });
    },

    /** The antenna and HDMI inputs; `connected` when the TV says a device is on (when it tells). */
    inputs: function (done) {
      if (samsung) { samsungInputs(done); return; }
      var list = INPUTS.map(function (x) { return {id: x.id, key: x.key, label: x.label, symbol: x.symbol, connected: true}; });
      if (!webos) {
        list[2].connected = false;
        list[3].connected = false;
        list[4].connected = false;
        done(list);
        return;
      }
      luna('luna://com.webos.service.eim/getAllInputStatus', {}, function (res) {
        var devices = res && res.devices ? res.devices : null;
        if (devices) {
          for (var i = 1; i < list.length; i++) {
            for (var j = 0; j < devices.length; j++) {
              var d = devices[j];
              if (d.appId !== list[i].id) continue;
              list[i].connected = d.connected !== false;
              // A name the person gave the input on the TV ("PS5"), if any.
              if (d.label && !/^hdmi\s*\d$/i.test(d.label)) list[i].label = d.label;
            }
          }
        }
        done(list);
      });
    },

    /** The TV's own settings; done(ok). */
    settings: function (done) {
      if (samsung) samsungSettings(done);
      else this.launch('com.palm.app.settings', null, done);
    },

    /** Back on the first screen: back to wherever the person came from. */
    back: function () {
      if (samsung) {
        try { window.tizen.application.getCurrentApplication().hide(); } catch (e) {}
        return;
      }
      if (window.PalmSystem && window.PalmSystem.platformBack) window.PalmSystem.platformBack();
    },

    /** The TV's time zone ("America/Sao_Paulo"), or ''. */
    zone: function () {
      if (samsung) {
        try { return window.tizen.time.getLocalTimezone() || ''; } catch (e) {}
      }
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
    },

    /** Key codes: the arrows, OK and the TV's Back (LG 461, Samsung 10009). */
    keys: {left: 37, up: 38, right: 39, down: 40, ok: 13, back: samsung ? 10009 : 461}
  };
})();
