/*
 * Developer Mode auto-renewal (Beta): the panel for the renewal service that is packaged with this home
 * (luna://com.gathin.tvhome.renewal/). Nothing runs when the home opens: the service is only asked when this panel
 * opens, and the person turns it on. Same service calls as the original launcher; the look is Free My TV's.
 */
(function () {
  'use strict';
  var SERVICE = 'luna://com.gathin.tvhome.renewal/';
  var panel = document.createElement('section');
  panel.id = 'renewalPanel';
  panel.className = 'hidden';
  panel.setAttribute('role', 'dialog');
  (document.getElementById('stage') || document.body).appendChild(panel);   // inside the scaled stage

  var status, toggle, check, details, buttons = [], index = 0, state = null, busy = false;

  function build() {
    panel.innerHTML = '';
    var card = document.createElement('div');
    card.className = 'card';
    panel.appendChild(card);
    function add(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text) e.textContent = text;
      card.appendChild(e);
      return e;
    }
    var head = add('div', 'head');
    var h = document.createElement('h2');
    h.textContent = tr('Renovação do Modo Desenvolvedor', 'Developer Mode renewal', 'Renovación del Modo Desarrollador');
    head.appendChild(h);
    var beta = document.createElement('span');
    beta.className = 'beta';
    beta.textContent = 'BETA';
    head.appendChild(beta);
    add('p', 'text', tr(
        'Renova a sessão do Modo Desenvolvedor direto com a LG, sem servidor nem computador.',
        'Renews your Developer Mode session directly with LG: no server or computer needed.',
        'Renueva la sesión del Modo Desarrollador directamente con LG, sin servidor ni ordenador.'));
    add('p', 'text warn', tr(
        'Em TVs sem root a renovação real ainda precisa de confirmação da comunidade. Continue olhando o contador do Modo Desenvolvedor. Uma TV desligada ou sem internet não renova.',
        'On TVs without root, real renewal still needs community confirmation. Keep an eye on the Developer Mode timer. A TV that is off or offline cannot renew.',
        'En teles sin root la renovación real aún necesita confirmación de la comunidad. Sigue mirando el contador del Modo Desarrollador. Una tele apagada o sin internet no puede renovar.'));
    status = add('div', 'state');
    var actions = add('div', 'actions');
    buttons = [];
    function button(text, onclick) {
      var b = document.createElement('button');
      b.textContent = text;
      b.onclick = onclick;
      actions.appendChild(b);
      buttons.push(b);
      return b;
    }
    toggle = button('', function () { if (state) action(state.enabled ? 'disable' : 'enable'); });
    check = button(tr('Verificar sessão', 'Check session', 'Comprobar sesión'), function () { action('check'); });
    button(tr('Diagnóstico', 'Diagnostics', 'Diagnóstico'), showDetails);
    button(tr('Ajustes da TV', 'TV Settings', 'Ajustes del TV'), function () { close(); tvSettings(); });
    button(tr('Voltar', 'Back', 'Volver'), close);
    details = add('pre', 'details hidden');
    for (var i = 0; i < buttons.length; i++) {
      (function (n) { buttons[n].addEventListener('mouseover', function () { focus(n); }); })(i);
    }
  }

  function openNow() { return panel.className.indexOf('hidden') < 0; }

  function focus(i) {
    var direction = i < index ? -1 : 1;
    for (var n = 0; n < buttons.length; n++, i += direction) {
      var j = (i + buttons.length * 2) % buttons.length;
      if (!buttons[j].disabled) {
        index = j;
        for (var k = 0; k < buttons.length; k++) buttons[k].className = k === j ? 'on' : '';
        buttons[j].focus();
        return;
      }
    }
  }

  function rpc(method, callback) {
    var bridge, done = false, timer = setTimeout(function () { finish(null); }, 45000);
    function finish(r) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (bridge) { try { bridge.cancel(); } catch (e) {} }
      callback(r);
    }
    try {
      bridge = new PalmServiceBridge();
      bridge.onservicecallback = function (raw) { try { finish(JSON.parse(raw)); } catch (e) { finish(null); } };
      bridge.call(SERVICE + method, '{}');
    } catch (e) { finish(null); }
  }

  function tvSettings() {
    try {
      var b = new PalmServiceBridge();
      b.onservicecallback = function () { b.cancel(); };
      b.call('luna://com.webos.applicationManager/launch', JSON.stringify({id: 'com.palm.app.settings', params: {}}));
    } catch (e) {}
  }

  function date(v) {
    return typeof v === 'number' ? new Date(v).toLocaleString() : tr('Ainda não', 'Not yet', 'Todavía no');
  }

  function label(s) {
    switch (s) {
      case 'healthy': return tr('Sessão verificada', 'Session checked', 'Sesión comprobada');
      case 'renewed': return tr('Renovação confirmada', 'Renewal confirmed', 'Renovación confirmada');
      case 'retry': return tr('Falha de conexão: nova tentativa agendada', 'Connection failed: retry scheduled', 'Fallo de conexión: reintento programado');
      case 'unverified': return tr('A resposta da LG não confirmou a renovação', 'LG response could not confirm renewal', 'La respuesta de LG no confirmó la renovación');
      case 'expired': return tr('Sessão expirada: abra o Modo Desenvolvedor', 'Session expired: open Developer Mode', 'Sesión caducada: abre el Modo Desarrollador');
      case 'unavailable': return tr('Nenhuma sessão legível do Modo Desenvolvedor', 'No readable Developer Mode session', 'No hay sesión legible del Modo Desarrollador');
      case 'session-changed': return tr('Sessão mudou: nova tentativa agendada', 'Session changed: retry scheduled', 'La sesión cambió: reintento programado');
      case 'storage-error': return tr('Não deu para salvar o estado', 'Could not save state', 'No se pudo guardar el estado');
      case 'internal-error': return tr('A verificação falhou', 'Check failed', 'Falló la comprobación');
    }
    return tr('Verificação pendente', 'Check pending', 'Comprobación pendiente');
  }

  function render() {
    toggle.textContent = state && state.enabled ? tr('Desativar Beta', 'Disable Beta', 'Desactivar Beta') : tr('Ativar Beta', 'Enable Beta', 'Activar Beta');
    check.disabled = busy || !state || !state.enabled;
    toggle.disabled = busy || !state;
    if (!state) return;
    var last = state.last || {};
    var text = state.enabled ? tr('Renovação automática ativada (Beta)', 'Auto-renewal enabled (Beta)', 'Renovación automática activada (Beta)')
        : tr('Renovação automática desligada', 'Auto-renewal off', 'Renovación automática desactivada');
    if (last.status) text += '\n' + label(last.status);
    if (typeof last.remainingSeconds === 'number') {
      var hours = Math.floor(Math.max(0, last.remainingSeconds - (Date.now() - last.checkedAt) / 1000) / 3600);
      text += ' · ' + tr(hours + ' horas restantes (estimativa)', hours + ' hours remaining (estimate)', hours + ' horas restantes (estimación)');
    }
    text += '\n' + tr('Última verificação: ', 'Last checked: ', 'Última comprobación: ') + date(last.checkedAt);
    text += '\n' + tr('Última renovação confirmada: ', 'Last confirmed renewal: ', 'Última renovación confirmada: ') + date(state.lastRenewedAt);
    if (state.error === 'disable-not-saved') text += '\n' + tr('Não deu para salvar o desligamento. Tente de novo antes de reiniciar o serviço.',
        'Disable could not be saved. Retry before restarting the service.', 'No se pudo guardar el apagado. Reinténtalo antes de reiniciar el servicio.');
    else if (state.error) text += '\n' + tr('Erro de configuração: ', 'Setup error: ', 'Error de configuración: ') + state.error;
    status.textContent = text;
    if (openNow()) focus(index);
  }

  function action(method) {
    if (busy) return;
    busy = true;
    status.textContent = tr('Trabalhando…', 'Working…', 'Trabajando…');
    toggle.disabled = true;
    check.disabled = true;
    rpc(method, function (r) {
      busy = false;
      if (!r || r.returnValue !== true) {
        state = null;
        status.textContent = tr('Serviço indisponível. Instale o pacote completo e tente de novo. Controle o Modo Desenvolvedor manualmente.',
            'Service unavailable. Install the complete package and try again. Manage your Developer Mode timer manually.',
            'Servicio no disponible. Instala el paquete completo y vuelve a probar. Controla el Modo Desarrollador a mano.');
        toggle.disabled = true;
        check.disabled = true;
        if (openNow()) focus(index);
        return;
      }
      state = r.state;
      render();
    });
  }

  function showDetails() {
    var last = state && state.last || {};
    details.textContent = JSON.stringify({home: '1.3.0', beta: true, enabled: !!(state && state.enabled),
      status: last.status || 'not-checked', checkedAt: last.checkedAt || null,
      remainingSeconds: typeof last.remainingSeconds === 'number' ? last.remainingSeconds : null,
      lastRenewedAt: state && state.lastRenewedAt || null, error: state && state.error || null}, null, 2);
    details.className = details.className.indexOf('hidden') < 0 ? 'details hidden' : 'details';
  }

  function close() { panel.className = 'hidden'; }

  // Captured before home.js sees the key, so the home never moves behind the panel.
  document.addEventListener('keydown', function (e) {
    if (!openNow()) return;
    var k = e.keyCode;
    if ([37, 38, 39, 40, 13, 461, 27, 8].indexOf(k) < 0) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (k === 461 || k === 27 || k === 8) close();
    else if (k === 13) { if (!e.repeat) buttons[index].click(); }
    else focus(index + (k === 37 || k === 38 ? -1 : 1));
  }, true);

  window.RenewalPanel = {
    isOpen: openNow,
    open: function () {
      build();
      panel.className = '';
      index = 0;
      focus(0);
      action('status');
    }
  };
}());
