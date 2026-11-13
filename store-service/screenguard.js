'use strict';
/*
 * Keeps LG's screensaver away while an app that does not do it itself is PLAYING (Stremio Origin 1.0.0: the TV's clock came up over its videos,
 * and the app died when it was covered). FreeTV's page cannot do this: the TV freezes it while another app is in front.
 *
 *   FMTV_PKEY=<the remote-control key FreeTV already has for the screen> node screenguard.js
 *
 * It asks the TV's power state (the remote control API on 127.0.0.1:3000) and answers the screensaver's announcement with turnOnScreen, only
 * when the app's own log says a video moved in the last 75 seconds: a paused or idle app gets LG's screensaver as usual (the panel's care).
 * It ends by itself when the app is gone for three minutes, or after eight hours. No libraries: a small WebSocket client over `net`.
 */
var net = require('net'), fs = require('fs'), crypto = require('crypto');

var KEY = String(process.env.FMTV_PKEY || '');
var APP_BIN = '/tv.stremioorigin.app/stremioorigin';
var APP_LOG = '/media/developer/apps/usr/palm/applications/tv.stremioorigin.app/data/applog.log';
var PIDFILE = '/tmp/fmtv-screenguard.pid';
var MANIFEST = {manifestVersion: 1, appVersion: '1.0', permissions: ['READ_POWER_STATE', 'CONTROL_POWER', 'CONTROL_TV_SCREEN', 'CONTROL_DISPLAY']};
var started = Date.now(), appPid = 0, goneSince = 0, woke = 0, wakes = 0;

function log(m) { console.log(new Date().toISOString() + ' ' + m); }

function findApp() {
  var pids = fs.readdirSync('/proc'), i;
  for (i = 0; i < pids.length; i++) {
    if (!/^\d+$/.test(pids[i])) continue;
    try { if (fs.readFileSync('/proc/' + pids[i] + '/cmdline', 'utf8').indexOf(APP_BIN) >= 0) return +pids[i]; } catch (e) {}
  }
  return 0;
}

function appAlive() {
  if (appPid) { try { if (fs.readFileSync('/proc/' + appPid + '/cmdline', 'utf8').indexOf(APP_BIN) >= 0) return true; } catch (e) {} appPid = 0; }
  appPid = findApp();
  return !!appPid;
}

/** Did a video move in the last 75 seconds? (The app writes its position every 30 s while it plays.) Exported for the tests. */
function playing(text, now) {
  var re = /(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z) \[video\] ev \{"currentTime"/g, m, last = 0;
  while ((m = re.exec(text))) last = Date.parse(m[1]) || last;
  return last > 0 && now - last < 75000 && now - last > -60000;
}

function isPlaying() {
  try {
    var st = fs.statSync(APP_LOG), fd = fs.openSync(APP_LOG, 'r'), n = Math.min(st.size, 16384), buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, st.size - n);
    fs.closeSync(fd);
    return playing(buf.toString('utf8'), Date.now());
  } catch (e) { return false; }
}

/** Is LG's screensaver on, or announced? */
function saverComing(p) {
  return !!p && (p.state === 'Screen Saver' || p.processing === 'Request Screen Saver' || p.processing === 'Screen Saver Ready');
}

// --- a WebSocket client, as small as this needs (text frames, pings)
function frame(text, opcode) {
  var data = Buffer.from(text, 'utf8'), n = data.length, head = n < 126 ? Buffer.alloc(2) : Buffer.alloc(4), mask = crypto.randomBytes(4), out = Buffer.alloc(n), i;
  head[0] = 0x80 | (opcode || 1);
  if (n < 126) head[1] = 0x80 | n; else { head[1] = 0x80 | 126; head.writeUInt16BE(n, 2); }
  for (i = 0; i < n; i++) out[i] = data[i] ^ mask[i % 4];
  return Buffer.concat([head, mask, out]);
}

/** Takes whole frames off `buf`: {frames: [{op, text}], rest}. Exported for the tests. */
function parse(buf) {
  var frames = [];
  while (buf.length >= 2) {
    var op = buf[0] & 0x0f, len = buf[1] & 0x7f, at = 2;
    if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); at = 4; }
    else if (len === 127) { if (buf.length < 10) break; len = buf.readUInt32BE(6); at = 10; }
    if (buf.length < at + len) break;
    frames.push({op: op, text: buf.slice(at, at + len).toString('utf8')});
    buf = buf.slice(at + len);
  }
  return {frames: frames, rest: buf};
}

var sock = null, ready = false, timer = null;

function send(obj) { try { if (sock) sock.write(frame(JSON.stringify(obj))); } catch (e) {} }

function connect() {
  var buf = Buffer.alloc(0), shaken = false;
  ready = false;
  sock = net.connect(3000, '127.0.0.1');
  sock.on('connect', function () {
    sock.write('GET / HTTP/1.1\r\nHost: 127.0.0.1:3000\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ' + crypto.randomBytes(16).toString('base64') + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
  });
  sock.on('data', function (d) {
    buf = Buffer.concat([buf, d]);
    if (!shaken) {
      var end = buf.indexOf('\r\n\r\n');
      if (end < 0) return;
      if (!/^HTTP\/1\.1 101/.test(buf.slice(0, end).toString())) { sock.destroy(); return; }
      shaken = true;
      buf = buf.slice(end + 4);
      send({type: 'register', id: 'register', payload: {forcePairing: false, pairingType: 'PROMPT', manifest: MANIFEST, 'client-key': KEY}});
    }
    var r = parse(buf);
    buf = r.rest;
    r.frames.forEach(function (f) {
      if (f.op === 9) { try { sock.write(frame(f.text, 10)); } catch (e) {} return; }
      if (f.op === 8) { sock.destroy(); return; }
      var m = null;
      try { m = JSON.parse(f.text); } catch (e) {}
      if (!m) return;
      if (m.type === 'registered') { ready = true; log('watching'); }
      else if (m.id === 'register' && m.type === 'error') { log('the TV no longer takes the key: ending'); process.exit(0); }   // never a prompt from here
      else if (m.id === 'state' && saverComing(m.payload) && Date.now() - woke > 1000 && isPlaying()) {
        woke = Date.now();
        wakes++;
        send({type: 'request', id: 'wake', uri: 'ssap://com.webos.service.tvpower/power/turnOnScreen'});
        log('screensaver sent away (' + wakes + ')');
      }
    });
  });
  sock.on('error', function () {});
  sock.on('close', function () { sock = null; ready = false; setTimeout(function () { if (!sock) connect(); }, 5000); });
}

function tick() {
  if (Date.now() - started > 8 * 3600000) { log('eight hours: ending'); process.exit(0); }
  if (appAlive()) goneSince = 0;
  else {
    if (!goneSince) goneSince = Date.now();
    if (Date.now() - goneSince > 180000) { log('the app is gone: ending'); process.exit(0); }
  }
  if (ready && appPid) send({type: 'request', id: 'state', uri: 'ssap://com.webos.service.tvpower/power/getPowerState'});
  timer = setTimeout(tick, 2500);
}

if (require.main === module) {
  if (!/^[A-Za-z0-9]{8,80}$/.test(KEY)) process.exit(2);
  // one guard at a time
  try {
    var old = parseInt(fs.readFileSync(PIDFILE, 'utf8'), 10);
    if (old > 0 && old !== process.pid && /screenguard/.test(fs.readFileSync('/proc/' + old + '/cmdline', 'utf8'))) process.kill(old);
  } catch (e) {}
  try { fs.writeFileSync(PIDFILE, String(process.pid)); } catch (e) {}
  process.on('exit', function () { try { if (parseInt(fs.readFileSync(PIDFILE, 'utf8'), 10) === process.pid) fs.unlinkSync(PIDFILE); } catch (e) {} });
  connect();
  tick();
}
module.exports = {playing: playing, parse: parse, frame: frame, saverComing: saverComing};
