/* Explicit recovery after long Home. Never clear a stop marker on page load. */
(function () {
  'use strict';
  var busy = false, checking = false, stopped = false, statusDenied = false;
  function rpc(uri, payload, callback) {
    var bridge, timer, done = false;
    function finish(result) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (bridge) { try { bridge.cancel(); } catch (_) {} }
      callback(result);
    }
    try {
      bridge = new PalmServiceBridge();
      bridge.onservicecallback = function (raw) {
        var result;
        try { result = JSON.parse(raw); } catch (_) { result = {returnValue:false}; }
        finish(result);
      };
      timer = setTimeout(function () { finish({returnValue:false}); }, 5000);
      bridge.call(uri, JSON.stringify(payload));
    } catch (_) { finish({returnValue:false}); }
  }
  function check() {
    if (checking || busy || document.hidden || statusDenied) return;
    checking = true;
    rpc('luna://com.webos.service.bus/signal/registerServerStatus', {serviceName:'com.local.nativehome', subscribe:true}, function (result) {
      checking = false;
      if (result.returnValue !== false && typeof result.connected === 'boolean') {
        stopped = !result.connected;
        window.setHelperResumeVisible(stopped);
      } else {
        // Unknown status must never be presented as a stopped helper.
        // Manual recovery remains available through the Home Helper app.
        stopped = false;
        window.setHelperResumeVisible(false);
        if (/denied|permission/i.test(result.errorText || '')) statusDenied = true;
      }
    });
  }
  window.HelperControl = {resume: function () {
    if (busy || !stopped) return;
    busy = true;
    window.helperResumeMessage('Enabling Home control…');
    rpc('luna://com.webos.applicationManager/launch', {id:'com.local.nativehome', params:{}}, function (result) {
      busy = false;
      if (result.returnValue === true) {
        window.helperResumeMessage('Home helper opened');
        check();
      }
      else window.helperResumeMessage('Could not enable Home control. Try again.');
    });
  }};
  document.addEventListener('visibilitychange', check);
  document.addEventListener('webOSRelaunch', check);
  setInterval(check, 5000);
  check();
}());
