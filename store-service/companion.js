'use strict';
/*
 * FreeTV's Companion: a tiny web page the TV serves to the phone, so text is typed on the phone and not with the remote.
 *
 *   node companion.js <token> [seconds idle before it exits]
 *
 * It is started by the store service when the Companion sheet opens, and it ends by itself (idle time, or /bye from the TV): nothing stays
 * in memory. No libraries. The phone needs the token in the address (the QR carries it); the TV's own page reads what was typed from
 * 127.0.0.1 and nothing else can. Only three fields exist and each is checked here and again by FreeTV.
 */
var http = require('http');
var token = String(process.argv[2] || ''), idleMs = (+process.argv[3] || 600) * 1000;
if (!/^[0-9a-f]{8,32}$/.test(token)) process.exit(2);

var queue = [], last = Date.now(), PORTS = [8089, 8090, 8091, 8092];
var FIELDS = {name: 24, note: 140, news: 300};

function lan(req) { return /^(::ffff:)?127\.0\.0\.1$|^::1$/.test(req.socket.remoteAddress || ''); }

var PAGE = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FreeTV</title>' +
  '<style>body{font:17px/1.4 system-ui,sans-serif;margin:0;padding:18px;background:#0e1116;color:#eef}h1{font-size:22px;margin:0 0 4px}p{color:#9ab;margin:4px 0 16px}' +
  'label{display:block;margin:18px 0 6px;font-weight:600}input{width:100%;box-sizing:border-box;font:inherit;padding:12px;border-radius:10px;border:1px solid #345;background:#18202a;color:#fff}' +
  'button{margin-top:8px;width:100%;font:inherit;font-weight:600;padding:12px;border:0;border-radius:10px;background:#3ddc97;color:#04210f}#ok{color:#3ddc97;min-height:1.4em;margin-top:14px}</style></head><body>' +
  '<h1>FreeTV</h1><p id="sub"></p>' +
  '<label id="l1"></label><input id="name" maxlength="24" autocomplete="off"><button data-f="name" id="b1"></button>' +
  '<label id="l2"></label><input id="note" maxlength="140" autocomplete="off"><button data-f="note" id="b2"></button>' +
  '<label id="l3"></label><input id="news" maxlength="300" inputmode="url" autocomplete="off" placeholder="https://"><button data-f="news" id="b3"></button>' +
  '<div id="ok"></div><script>' +
  'var L=(navigator.language||"en").slice(0,2),A={es:["Escribe aquí y aparece en la tele.","Tu nombre (saludo)","Nota o recordatorio","Noticias (dirección RSS https)","Enviar","Enviado a la tele ✓","No llegó: ¿sigue abierto Companion en la tele?"],' +
  'pt:["Escreva aqui e aparece na TV.","Seu nome (saudação)","Nota ou lembrete","Notícias (endereço RSS https)","Enviar","Enviado para a TV ✓","Não chegou: o Companion ainda está aberto na TV?"],' +
  'en:["Type here and it shows up on the TV.","Your name (greeting)","Note or reminder","News (https RSS address)","Send","Sent to the TV ✓","It did not arrive: is Companion still open on the TV?"]},T=A[L]||A.en;' +
  'function $(i){return document.getElementById(i)}$("sub").textContent=T[0];["l1","l2","l3"].forEach(function(id,i){$(id).textContent=T[i+1]});["b1","b2","b3"].forEach(function(id){$(id).textContent=T[4]});' +
  'var q=location.search;Array.prototype.forEach.call(document.getElementsByTagName("button"),function(b){b.onclick=function(){var f=b.getAttribute("data-f"),v=$(f).value;if(!v)return;' +
  'var x=new XMLHttpRequest();x.open("POST","/send"+q);x.onload=function(){$("ok").textContent=x.status==200?T[5]:T[6];if(x.status==200)$(f).value=""};x.onerror=function(){$("ok").textContent=T[6]};x.send(JSON.stringify({f:f,v:v}))}});' +
  '</script></body></html>';

function ok(req, query) { return query.indexOf('t=' + token) >= 0; }

var server = http.createServer(function (req, res) {
  var parts = req.url.split('?'), p = parts[0], query = parts[1] || '', local = lan(req);
  if (p === '/bye' && local) { res.end('bye'); setTimeout(function () { process.exit(0); }, 100); return; }
  if (p === '/inbox' && local) {   // the TV's own page; the queue is emptied as it is read
    res.writeHead(200, {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store'});
    res.end(JSON.stringify(queue.splice(0)));
    return;
  }
  if (!ok(req, query)) { res.writeHead(403); res.end('403'); return; }
  last = Date.now();
  if (p === '/' && req.method === 'GET') { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'}); res.end(PAGE); return; }
  if (p === '/send' && req.method === 'POST') {
    var body = '';
    req.on('data', function (c) { body += c; if (body.length > 2000) req.destroy(); });
    req.on('end', function () {
      var d;
      try { d = JSON.parse(body); } catch (e) { d = null; }
      if (!d || !Object.prototype.hasOwnProperty.call(FIELDS, d.f) || typeof d.v !== 'string' || !d.v || d.v.length > FIELDS[d.f] || (d.f === 'news' && !/^https:\/\//.test(d.v))) {
        res.writeHead(400); res.end('bad'); return;
      }
      if (queue.length < 20) queue.push({f: d.f, v: d.v});
      res.end('ok');
    });
    return;
  }
  res.writeHead(404); res.end('404');
});

function listen(i) {
  if (i >= PORTS.length) process.exit(3);
  server.once('error', function () { listen(i + 1); });
  server.listen(PORTS[i], '0.0.0.0', function () { console.log('listening ' + PORTS[i]); });
}
listen(0);
setInterval(function () { if (Date.now() - last > idleMs) process.exit(0); }, 5000);
