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

  /** helper-control.js tells us when a long press of Home stopped the helper. */
  window.setHelperResumeVisible = function (visible) {
    var was = stopped;
    stopped = !!visible;
    if (stopped && !was) {
      toast(tr('O botão Home está parado. Ative-o em Ajustes do Início.',
          'The Home button is paused. Turn it back on in Home Settings.',
          'El botón Home está parado. Actívalo en Ajustes de inicio.'));
    }
  };

  window.helperResumeMessage = function (text) {
    var m = MESSAGES[text];
    toast(m ? tr(m[0], m[1], m[2]) : text);
  };

  window.HomeExtras = {
    /** Extra rows for Home Settings, in the shape home.js uses: {label, value, step(direction)}. */
    rows: function () {
      var rows = [];
      if (stopped) {
        rows.push({label: tr('Reativar o botão Home', 'Turn the Home button back on', 'Reactivar el botón Home'), value: '›',
          step: function (d) { if (d >= 0 && window.HelperControl) window.HelperControl.resume(); }});
      }
      rows.push({label: tr('Renovação do Modo Desenvolvedor', 'Developer Mode renewal', 'Renovación del Modo Desarrollador'), value: '›',
        step: function (d) { if (d >= 0 && window.RenewalPanel) window.RenewalPanel.open(); }});
      return rows;
    }
  };
}());
