/*
 * Starts Home Helper (the native piece that gives this home the Home button) every time this app opens, as the
 * original launcher did. A page load is an opening; so is a relaunch of a running page.
 * nativeHomeAuto makes the helper respect a long-Home stop: opening this app never turns the Home button back on.
 */
(function () {
  'use strict';
  var bridge, timer;
  function release() {
    clearTimeout(timer);
    if (bridge) { try { bridge.cancel(); } catch (e) {} bridge = null; }
  }
  function start() {
    release();
    try {
      bridge = new PalmServiceBridge();
      bridge.onservicecallback = release;
      timer = setTimeout(release, 8000);
      bridge.call('luna://com.webos.applicationManager/launch',
          JSON.stringify({id: 'com.local.nativehome', params: {nativeHomeAuto: true}}));
    } catch (e) {
      release();
    }
  }
  document.addEventListener('webOSRelaunch', start);
  start();
}());
