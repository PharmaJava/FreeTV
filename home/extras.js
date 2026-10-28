/*
 * What the LG home adds to Free My TV: rows in Home Settings for Developer Mode auto-renewal and for turning the Home
 * button back on, and the messages Home Helper's recovery code (helper-control.js) shows.
 */
(function () {
  'use strict';
  var stopped = false;

  var MESSAGES = {
    'Enabling Home control…': ['Ativando o botão Home…', 'Turning the Home button on…', 'Activando el botón Home…'],
    'Home helper opened': ['Botão Home ativado', 'Home button is on', 'Botón Home activado'],
    'Could not enable Home control. Try again.': ['Não deu para ativar o botão Home. Tente de novo.',
      'Could not turn the Home button on. Try again.', 'No se pudo activar el botón Home. Inténtalo de nuevo.']
  };

  function toast(text) {
    if (window.FreeMyTV && window.FreeMyTV.toast) window.FreeMyTV.toast(text);
  }

  var known = false, autoAt = 0;

  /** helper-control.js tells us whether the helper runs. A long press of Home (or a failure) stops it, and then the TV opens
      neither FreeTV at start-up nor on Home. With "turn it back on by itself" (on by default), opening FreeTV turns it back on. */
  window.setHelperResumeVisible = function (visible) {
    var was = stopped;
    stopped = !!visible;
    known = true;
    if (stopped && window.Prefs && Prefs.homeAuto() && !document.hidden && Date.now() - autoAt > 60000 && window.HelperControl) {
      autoAt = Date.now();   // once a minute at most: a helper that keeps failing is not started in a loop
      window.HelperControl.resume();
    } else if (stopped && !was) {
      toast(tr('O botão Home está parado. Ative-o em Ajustes do Início → Início.',
          'The Home button is paused. Turn it back on in Home Settings → Home.',
          'El botón Home está parado. Actívalo en Ajustes de inicio → Inicio.'));
    }
    if (was !== stopped && window.FreeMyTV && window.FreeMyTV.settingsChanged) window.FreeMyTV.settingsChanged();
  };

  window.helperResumeMessage = function (text) {
    var m = MESSAGES[text];
    toast(m ? tr(m[0], m[1], m[2]) : text);
  };

  window.HomeExtras = {
    /** Extra rows for Home Settings, in the shape home.js uses: {label, value, step(direction)}. */
    /** The Home button's rows for Home Settings → Home: whether it works (OK turns it back on), and the automatic resume. */
    homeRows: function () {
      var on = tr('Ligado', 'On', 'Activado');
      return [
        {label: tr('Botão Home e início com o FreeTV', 'Home button and start-up in FreeTV', 'Botón Home y arranque con FreeTV'),
          value: !known ? '…' : stopped ? tr('Parado · OK liga', 'Paused · OK turns it on', 'Parado · OK lo activa') : on,
          step: function (d) {
            if (d < 0) return;
            if (stopped && window.HelperControl) window.HelperControl.resume();
            else toast(tr('Está ligado. Para pará-lo, mantenha Home 2 segundos.', 'It is on. To stop it, hold Home for 2 seconds.',
              'Está activado. Para pararlo, mantén Home 2 segundos.'));
          }},
        {label: tr('Religá-lo sozinho ao abrir o FreeTV', 'Turn it back on when FreeTV opens', 'Reactivarlo solo al abrir FreeTV'),
          toggle: Prefs.homeAuto(), step: function () { Prefs.set('homeAuto', !Prefs.homeAuto()); }}
      ];
    },
    rows: function () {
      var rows = [];
      rows.push({label: tr('Renovação do Modo Desenvolvedor', 'Developer Mode renewal', 'Renovación del Modo Desarrollador'), value: '›',
        step: function (d) { if (d >= 0 && window.RenewalPanel) window.RenewalPanel.open(); }});
      return rows;
    }
  };
}());
