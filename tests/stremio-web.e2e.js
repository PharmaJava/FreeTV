'use strict';
// Stremio Claude's Samsung web version (home/stremio/) in a browser, against pretend accounts, addons, subtitles and video.
// Needs Playwright and ffmpeg: python3 tizen/build.py --no-channels --preview && node tests/stremio-web.e2e.js   (screenshots go to the temp folder)
const { chromium } = require('playwright');
const os = require('os'), cp = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'out', 'tizen'), SP = fs.mkdtempSync(path.join(os.tmpdir(), 'stremio-web-'));
cp.execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=20:size=640x360:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=20', '-c:v', 'libvpx', '-b:v', '200k', '-c:a', 'libvorbis', path.join(SP, 'test.webm')]);
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webm':'video/webm'};
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0].split('#')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, {'content-type': types[path.extname(f)] || 'application/octet-stream'}); r.end(fs.readFileSync(f));
});
const assert = require('assert');
(async () => {
  await new Promise(r => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const puts = [], errors = []; let reads = 0, created = 0;
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const json = (route, o) => route.fulfill({ status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(o) });
  const manifest = {id: 'test.addon', name: 'Test Addon', types: ['movie', 'series'], idPrefixes: ['tt'], resources: ['catalog', 'meta', 'stream', 'subtitles'],
    catalogs: [{type: 'movie', id: 'top', name: 'Top'}, {type: 'series', id: 'top', name: 'Shows', extra: [{name: 'search'}]}, {type: 'movie', id: 'search', name: 'Find', extra: [{name: 'search', isRequired: true}]}]};
  const metas = [1,2,3,4,5,6,7,8].map(i => ({id: 'tt000000' + i, type: 'movie', name: 'Film ' + i, poster: ''}));
  await page.route(/https?:\/\/(?!127\.0\.0\.1)[^/]+\/.*/, async route => {
    const u = new URL(route.request().url()), p = u.pathname;
    if (u.host === 'link.stremio.com') { if (p.endsWith('/create')) { created++; return json(route, {code: 'ABCD', link: 'https://link.stremio.com/ABCD'}); } if (++reads < 2) return json(route, {}); return json(route, {result: {authKey: 'KEY'}}); }
    if (u.host === 'api.strem.io') {
      const body = JSON.parse(route.request().postData() || '{}');
      if (p.endsWith('getUser')) return json(route, {result: {email: 'amigo@example.com'}});
      if (p.endsWith('addonCollectionGet')) return json(route, {result: {addons: [{transportUrl: 'https://addon.test/manifest.json', manifest}]}});
      if (p.endsWith('datastoreGet')) return json(route, {result: [{_id: 'tt0000003', name: 'Film 3', type: 'movie', poster: '', removed: false, temp: false, _mtime: '2026-01-01T00:00:00Z', state: {timeOffset: 600000, duration: 1200000, video_id: 'tt0000003', lastWatched: '2026-01-01T00:00:00Z'}}]});
      if (p.endsWith('datastorePut')) { puts.push(body); return json(route, {result: {success: true}}); }
      return json(route, {result: {}});
    }
    if (u.host === 'addon.test') {
      if (p === '/catalog/movie/top.json') return json(route, {metas});
      if (p === '/catalog/series/top.json') return json(route, {metas: [{id: 'tt1111111', type: 'series', name: 'Show One'}]});
      if (p.startsWith('/catalog/movie/search/search=')) return json(route, {metas: [{id: 'tt0000005', type: 'movie', name: 'Found film'}]});
      if (p === '/meta/movie/tt0000003.json') return json(route, {meta: {id: 'tt0000003', type: 'movie', name: 'Film 3', description: 'A film for tests.', imdbRating: '7.9', releaseInfo: '2020', runtime: '120 min', genres: ['Drama']}});
      if (p === '/meta/series/tt1111111.json') return json(route, {meta: {id: 'tt1111111', type: 'series', name: 'Show One', description: 'A show.', videos: [{id: 'tt1111111:1:1', season: 1, episode: 1, title: 'Pilot'}, {id: 'tt1111111:1:2', season: 1, episode: 2, title: 'Second'}, {id: 'tt1111111:2:1', season: 2, episode: 1, title: 'Back'}]}});
      if (p.startsWith('/stream/movie/tt0000003')) return json(route, {streams: [{name: 'Direct 1080p', description: 'Release.mkv\n1.2 GB', url: base + '/stremio/../test.webm'}, {name: 'Torrent 4K', infoHash: 'a'.repeat(40), fileIdx: 1}, {name: 'Trailer', ytId: 'abc'}]});
      if (p.startsWith('/stream/series/tt1111111:1:2')) return json(route, {streams: [{name: 'Ep direct', url: base + '/test.webm'}]});
      if (p.startsWith('/subtitles/movie/tt0000003')) return json(route, {subtitles: [{id: '1', lang: 'spa', url: 'https://subs.test/es.srt'}, {id: '2', lang: 'eng', url: 'https://subs.test/en.srt'}]});
    }
    if (u.host === 'subs.test') return route.fulfill({status: 200, headers: {'access-control-allow-origin': '*'}, contentType: 'text/plain', body: '1\n00:00:01,000 --> 00:00:04,000\nHola mundo\n'});
    return route.fulfill({status: 404, body: ''});
  });
  await page.route(base + '/test.webm', route => {
    const buf = fs.readFileSync(SP + '/test.webm'), rg = /bytes=(\d+)-(\d*)/.exec(route.request().headers()['range'] || '');
    if (!rg) return route.fulfill({status: 200, headers: {'accept-ranges': 'bytes'}, contentType: 'video/webm', body: buf});
    const a = +rg[1], z = rg[2] ? +rg[2] : buf.length - 1;
    route.fulfill({status: 206, headers: {'accept-ranges': 'bytes', 'content-range': 'bytes ' + a + '-' + z + '/' + buf.length}, contentType: 'video/webm', body: buf.slice(a, z + 1)});
  });
  let engineUp = false; const creates = [];
  await page.exposeFunction('engineStarted', () => { engineUp = true; });
  await page.addInitScript(() => {   // TizenBrew's service on ws://127.0.0.1:8081, pretended
    window.WebSocket = function (url) {
      const me = this; this.url = url;
      setTimeout(() => me.onopen && me.onopen(), 20);
      this.send = (d) => {
        const m = JSON.parse(d); (window.__brew = window.__brew || []).push(m);
        if (m.type === 4) setTimeout(() => me.onmessage({ data: JSON.stringify({ type: 4, payload: [{ fullName: 'gh/PharmaJava/FreeTV@v2.17.0/tizenbrew-torrent', serviceFile: 'service.js', appName: 'Stremio Claude Torrents' }] }) }), 30);
        if (m.type === 6) window.engineStarted();
      };
      this.close = () => {};
    };
  });
  await page.route(/127\.0\.0\.1:11470/, (route) => {   // the engine on the TV: only once its service was started
    const u = new URL(route.request().url());
    if (!engineUp) return route.abort('connectionrefused');
    if (u.pathname === '/status') return json(route, { ok: true, name: 'freetv-torrents' });
    if (u.pathname.endsWith('/create')) { creates.push(JSON.parse(route.request().postData())); return json(route, { files: [{ name: 'a.webm', length: 545342 }], guessedFileIdx: 1 }); }
    const buf = fs.readFileSync(SP + '/test.webm');
    return route.fulfill({ status: 200, headers: { 'accept-ranges': 'bytes', 'access-control-allow-origin': '*' }, contentType: 'video/webm', body: buf });
  });
  await page.goto(base + '/stremio/index.html');
  const key = k => page.keyboard.press(k);
  const txt = () => page.evaluate(() => document.body.innerText);

  // 1. login screen
  await page.waitForSelector('.login .code');
  await page.waitForFunction(() => document.querySelector('.login .code').textContent === 'ABCD');
  assert.ok(await page.evaluate(() => { const c = document.querySelector('.login canvas'); return c.width > 20; }), 'QR drawn');
  await page.screenshot({ path: SP + '/s1-login.png' });
  // 2. after the phone links: home
  await page.waitForSelector('.rowbox .card', { timeout: 15000 });
  assert.ok((await txt()).includes('amigo@example.com'));
  let t = await txt();
  assert.ok(t.includes('Continuar viendo') || t.includes('Continue watching'), 'continue watching row: ' + t.slice(0, 200));
  assert.ok(t.includes('Top'), 'catalog row'); assert.ok(!t.includes('Find'), 'a search-only catalog is not a row');
  await page.screenshot({ path: SP + '/s2-home.png' });
  // 3. focus moves down to the row and right; open detail of Film 3 via continue watching (first card)
  await key('ArrowDown'); // from first focus (continue card) maybe tab? ensure focus is inside view
  await page.waitForTimeout(100);
  const f1 = await page.evaluate(() => document.querySelector('.f.on') && document.querySelector('.f.on').getAttribute('data-k'));
  console.log('focus after down:', f1);
  // go to the continue card explicitly
  await page.evaluate(() => { const e = document.querySelector('[data-k^="cw:"]'); StremioClaude.go; });
  await page.screenshot({ path: SP + '/s3-focus.png' });
  // press Enter on whatever is focused: should be a card -> detail
  await key('ArrowUp'); await key('Enter');
  await page.waitForSelector('.hero .btn');
  t = await txt();
  console.log('detail text:', t.replace(/\n+/g, ' | ').slice(0, 200));
  assert.ok(t.includes('Film 3') && t.includes('A film for tests.') && t.includes('7.9'));
  assert.ok(/Continuar|Resume/.test(t), 'resume button for a started title');
  await page.screenshot({ path: SP + '/s4-detail.png' });
  // 4. play -> sources
  await key('Enter');
  await page.waitForSelector('.src');
  await page.waitForFunction(() => document.querySelectorAll('.src').length >= 2);
  t = await txt();
  assert.ok(t.includes('Direct 1080p') && t.includes('Torrent 4K') && t.includes('Trailer'));
  await page.screenshot({ path: SP + '/s5-streams.png' });
  // a torrent with no server: the person is asked first (nothing is added to TizenBrew without a yes)
  await key('ArrowDown'); await key('Enter');
  await page.waitForSelector('.login h1');
  t = await txt();
  assert.ok(/Torrents on this TV|Torrents en esta tele/.test(t) && /tizenbrew-torrent/.test(t), t.slice(0, 200));
  await page.screenshot({ path: SP + '/s5b-ask.png' });
  assert.deepStrictEqual(await page.evaluate(() => window.__brew || []), [], 'nothing was sent to TizenBrew yet');
  await key('ArrowRight'); await key('Enter');   // Not now
  await page.waitForSelector('.src');
  assert.deepStrictEqual(await page.evaluate(() => window.__brew || []), []);
  assert.strictEqual(await page.evaluate(() => window.localStorage.getItem('sc.engine')), null);
  // yes: the module is added, its service started, and the torrent plays through the engine on this TV
  await key('Enter'); await page.waitForSelector('.login h1');
  await key('Enter');   // Turn torrents on
  await page.waitForSelector('#player video', { timeout: 20000 });
  const brew = await page.evaluate(() => window.__brew);
  assert.strictEqual(brew[0].type, 10); assert.deepStrictEqual(brew[0].payload, {action: 'add', module: 'gh/PharmaJava/FreeTV@v2.17.0/tizenbrew-torrent'});
  assert.ok(brew.some((m) => m.type === 4) && brew.some((m) => m.type === 6 && m.payload.serviceFile === 'service.js'), JSON.stringify(brew));
  assert.strictEqual(await page.evaluate(() => window.localStorage.getItem('sc.engine')), '1');
  assert.ok(creates.length === 1 && creates[0].peerSearch.sources.indexOf('dht:' + 'a'.repeat(40)) >= 0 && creates[0].fileIdx === 1, JSON.stringify(creates));
  assert.ok((await page.evaluate(() => document.querySelector('#player video').src)).indexOf('http://127.0.0.1:11470/' + 'a'.repeat(40) + '/1') === 0);
  await page.screenshot({ path: SP + '/s5c-engine.png' });
  await key('Escape'); await page.waitForFunction(() => document.getElementById('player').style.display === 'none');
  // direct: player
  await key('ArrowUp'); await key('Enter');
  await page.waitForSelector('#player video');
  await page.waitForFunction(() => { const v = document.querySelector('#player video'); return v && v.readyState >= 1; }, null, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('#player video track').length === 1, null, { timeout: 15000 });
  const cur = await page.evaluate(() => document.querySelector('#player video').currentTime);
  console.log('player resumed at', cur);
  await page.screenshot({ path: SP + '/s6-player.png' });
  const vtt = await page.evaluate(async () => { const tr = document.querySelector('#player video track'); const r = await fetch(tr.src); return (await r.text()); });
  assert.ok(/^WEBVTT/.test(vtt) && /00:00:01\.000 --> 00:00:04\.000/.test(vtt) && vtt.includes('Hola mundo'), vtt);
  // subtitle menu
  await key('ArrowUp'); await page.waitForSelector('#player .menu');
  await page.screenshot({ path: SP + '/s7-menu.png' });
  await key('ArrowDown'); await key('ArrowDown'); await key('Enter');
  await page.waitForTimeout(500);
  await page.waitForTimeout(1500); console.log('state', await page.evaluate(() => { const v = document.querySelector('#player video'); return [v.currentTime, v.paused, v.readyState, v.seekable.length]; })); await key('ArrowRight'); await key('Enter'); // seek, pause
  assert.ok(await page.evaluate(() => document.querySelector('#player video').paused));
  const before = puts.length;
  await key('Escape');
  await page.waitForFunction(() => document.getElementById('player').style.display === 'none');
  await page.waitForTimeout(300);
  assert.ok(puts.length > before, 'progress saved to the account');
  const saved = puts[puts.length - 1].changes[0];
  console.log('saved:', JSON.stringify(saved.state));
  assert.strictEqual(saved._id, 'tt0000003'); assert.ok(saved.state.timeOffset > 0 && saved.state.duration > 15000 && saved.state.video_id === 'tt0000003');
  // back on the sources list, then Back twice to home
  assert.ok((await txt()).includes('Direct 1080p'));
  await key('Escape'); await page.waitForSelector('.hero'); await key('Escape'); await page.waitForSelector('.rowbox');
  // 5. series
  await page.evaluate(() => StremioClaude.go('detail', {type: 'series', id: 'tt1111111', item: {id: 'tt1111111', type: 'series', name: 'Show One'}}));
  await page.waitForSelector('.ep');
  t = await txt();
  assert.ok(t.includes('Pilot') && t.includes('Second') && !t.includes('Back'), 'season 1 only: ' + t.slice(0, 300));
  assert.ok(/Temporada 2|Season 2/.test(t));
  await page.screenshot({ path: SP + '/s8-series.png' });
  // 6. search
  await page.evaluate(() => StremioClaude.go('search', {}, true));
  await page.waitForSelector('.sbox input');
  await page.focus('.sbox input'); await page.keyboard.type('found'); await key('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('Found film'));
  await page.screenshot({ path: SP + '/s9-search.png' });
  // 7. settings
  await page.evaluate(() => StremioClaude.go('set', {}, true));
  await page.waitForSelector('.set .row');
  await page.screenshot({ path: SP + '/s10-settings.png' });
  // pure helpers
  const h = await page.evaluate(() => ({
    vtt: StremioClaude.srtToVtt('1\r\n00:00:01,500 --> 00:00:02,000\r\nHi'),
    req: StremioClaude.catExtra({extra: [{name: 'genre', isRequired: true, options: ['Action', 'Drama']}]}),
    srch: StremioClaude.catExtra({extra: [{name: 'search', isRequired: true}]}),
    res: [StremioClaude.hasRes({resources: [{name: 'stream', types: ['movie'], idPrefixes: ['tt']}], types: ['movie', 'series']}, 'stream', 'movie', 'tt1'), StremioClaude.hasRes({resources: [{name: 'stream', types: ['movie'], idPrefixes: ['tt']}]}, 'stream', 'series', 'tt1'), StremioClaude.hasRes({resources: ['stream'], types: ['movie']}, 'stream', 'movie', 'kitsu:1')]
  }));
  assert.ok(h.vtt.startsWith('WEBVTT') && h.vtt.includes('00:00:01.500')); assert.strictEqual(h.req, 'genre=Action'); assert.strictEqual(h.srch, null); assert.deepStrictEqual(h.res, [true, false, true]);
  console.log('page errors:', errors.filter(e => !/404|Failed to load resource/.test(e)));
  await browser.close(); srv.close();
  console.log('ALL OK');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
