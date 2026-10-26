/*
 * Samsung only: TizenBrew (github.com/reisxd/TizenBrew), the community "store" for Samsung TVs. It runs modules: TizenTube
 * (YouTube without ads, which TizenBrew installs by default), Twizen (Twitch without ads) and many more, published on npm or GitHub.
 * FreeTV does not run them itself; it asks TizenBrew:
 *   - to open a module: an app control to TizenBrew with {moduleName, moduleType} (TizenBrew reads it when it starts),
 *   - which modules it has, and to add or remove one: TizenBrew's own service, a WebSocket on ws://127.0.0.1:8081 that only
 *     answers while TizenBrew has been opened since the TV started (it stays in the background).
 * Modules are other people's code: FreeTV asks before adding one. Plain ES5 (Tizen 3 runs a 2015 Chromium).
 */
window.TizenBrew = (function () {
  'use strict';

  var APP = 'xvvl3S1bvH.TizenBrewStandalone';
  var SERVICE = 'ws://127.0.0.1:8081';
  var EV = {Error: 8, GetModules: 4, ModuleAction: 10};   // TizenBrew's service events (service-nextgen/service/utils/wsCommunication.js)
  var SEARCH = 'https://registry.npmjs.org/-/v1/search?size=20&text=keywords:tizenbrew%20';

  /** The modules FreeTV offers first, and puts on the shelf (youtube, twitch). Names as TizenBrew wants them: npm/<package>. */
  var RECOMMENDED = [
    {full: 'npm/@foxreis/tizentube', shelf: 'youtube', title: 'YouTube AdFree', icon: 'icons/youtube.png',
      about: ['YouTube sem anúncios nem patrocínios (TizenTube). O TizenBrew já o traz.', 'YouTube without ads or sponsor segments (TizenTube). TizenBrew comes with it.',
        'YouTube sin anuncios ni patrocinios (TizenTube). TizenBrew ya lo trae.']},
    {full: 'npm/@jjg0/twizen', shelf: 'twitch', title: 'Twitch AdFree', icon: 'icons/twitch.svg',
      about: ['Twitch sem anúncios (Twizen): diretos, categorias, VODs e o chat.', 'Twitch without ads (Twizen): live streams, categories, VODs and chat.',
        'Twitch sin anuncios (Twizen): directos, categorías, vídeos y el chat.']},
    {full: 'npm/@gforceweb/smarttv-twitch-hls', title: 'Twitch HLS',
      about: ['Outro cliente de Twitch, com diretos em 1440p onde a TV consegue.', 'Another Twitch client, with 1440p streams where the TV can play them.',
        'Otro cliente de Twitch, con directos a 1440p donde la tele puede.']}
  ];

  function installed(apps) {
    for (var i = 0; i < apps.length; i++) if (apps[i].id === APP) return true;
    return false;
  }

  /** 'npm/@jjg0/twizen' -> {moduleType: 'npm', moduleName: '@jjg0/twizen'}; null if it is not a module name TizenBrew takes. */
  function parse(full) {
    var m = /^(npm|gh)\/((?:@[a-z0-9._-]+\/)?[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)?)$/.exec(String(full || ''));
    return m ? {moduleType: m[1], moduleName: m[2]} : null;
  }

  /** Opens a module in TizenBrew (or TizenBrew itself, with full null); done(ok). */
  function launch(full, done) {
    var tizen = window.tizen;
    try {
      var p = full ? parse(full) : null, data = [];
      if (p) data.push(new tizen.ApplicationControlData('module', [JSON.stringify(p)]));
      var control = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/view', null, null, null, data);
      tizen.application.launchAppControl(control, APP, function () { if (done) done(true); }, function () {
        try { tizen.application.launch(APP, function () { if (done) done(true); }, function () { if (done) done(false); }); }
        catch (e) { if (done) done(false); }
      });
    } catch (e) {
      if (done) done(false);
    }
  }

  /** One request to TizenBrew's service: sends {type, payload}, waits for an answer of type `want` (or none, then done(null, true)). */
  function ask(type, payload, want, done) {
    var ws, over = false;
    function finish(err, value) {
      if (over) return;
      over = true;
      clearTimeout(timer);
      try { ws.close(); } catch (e) {}
      done(err, value);
    }
    var timer = setTimeout(function () { finish(new Error('timeout')); }, want === null ? 4000 : 15000);
    try { ws = new WebSocket(SERVICE); } catch (e) { finish(new Error('closed')); return; }
    ws.onopen = function () {
      ws.send(JSON.stringify({type: type, payload: payload}));
      if (want === null) setTimeout(function () { finish(null, true); }, 600);   // ModuleAction has no answer: give it time to write
    };
    ws.onmessage = function (e) {
      var msg = null;
      try { msg = JSON.parse(e.data); } catch (x) { return; }
      if (msg.type === want) finish(null, msg.payload);
      else if (msg.type === EV.Error) finish(new Error(String(msg.payload || 'error')));
    };
    ws.onerror = function () { finish(new Error('closed')); };
    ws.onclose = function () { finish(new Error('closed')); };
  }

  /** The modules TizenBrew has: done(err, ['npm/@foxreis/tizentube', ...]). err 'closed' when TizenBrew has not been opened yet. */
  function modules(done) {
    ask(EV.GetModules, true, EV.GetModules, function (err, list) {
      if (err) { done(err); return; }
      done(null, (list || []).map(function (m) { return m.fullName; }).filter(Boolean));
    });
  }

  /** Adds (or removes) a module in TizenBrew's list; done(err). */
  function change(action, full, done) {
    if (!parse(full)) { done(new Error('bad name')); return; }
    ask(EV.ModuleAction, {action: action, module: full}, null, function (err) { done(err); });
  }

  /** Modules published on npm for TizenBrew that match some text: done(err, [{full, title, about}]). */
  function search(text, done) {
    var x = new XMLHttpRequest(), over = false;
    x.open('GET', SEARCH + encodeURIComponent(String(text || '').slice(0, 60)), true);
    x.timeout = 15000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4 || over) return;
      over = true;
      var out = [];
      try {
        var objs = JSON.parse(x.responseText).objects || [];
        for (var i = 0; i < objs.length; i++) {
          var p = objs[i].package || {};
          if (p.name) out.push({full: 'npm/' + p.name, title: p.name, about: String(p.description || '').slice(0, 200)});
        }
      } catch (e) { done(new Error('search')); return; }
      done(null, out);
    };
    x.send();
  }

  return {APP: APP, RECOMMENDED: RECOMMENDED, installed: installed, parse: parse, launch: launch, modules: modules,
    add: function (full, done) { change('add', full, done); }, remove: function (full, done) { change('remove', full, done); }, search: search};
})();
