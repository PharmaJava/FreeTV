/*
 * On-screen text in Portuguese, English, Spanish, German and Russian (the same copy as the Android app).
 * tr(pt, en, es): the text in the current language. The language follows the TV unless set in Home Settings.
 */
var I18N = (function () {
  'use strict';

  var lang = 'en';
  var german = {
    "Live TV": "Live-TV",
    "All Apps": "Alle Apps",
    "Settings": "Einstellungen",
    "Screensaver": "Bildschirmschoner",
    "Quick panel": "Schnellpanel",
    "TV health": "Zustand des Fernsehers",
    "Sleep timer": "Ausschalt-Timer",
    "Kids mode": "Kindermodus",
    "Apps, channels, YouTube": "Apps, Kanäle, YouTube",
    "Look, apps, privacy…": "Aussehen, Apps, Datenschutz…",
    "Results": "Ergebnisse",
    "Store": "Store",
    "Search for something else": "Etwas anderes suchen",
    "Type with the TV keyboard and press Enter.": "Mit der Fernseh-Tastatur eingeben und Enter drücken.",
    "Wrong PIN": "Falsche PIN",
    "Repeat the PIN": "PIN wiederholen",
    "Leave kids mode": "Kindermodus verlassen",
    "Type the PIN.": "PIN eingeben.",
    "Got it": "Verstanden",
    "Privacy": "Datenschutz",
    "Which tab to open on?": "Mit welchem Tab starten?",
    "The last one I used": "Der zuletzt benutzte",
    "Sleep timer off": "Timer aus",
    "Updates": "Updates",
    "Free space": "Freier Speicher",
    "Store on the TV": "Store auf dem Fernseher",
    "Ready": "Bereit",
    "All good": "Alles in Ordnung",
    "Kids mode on": "Kindermodus an",
    "Kids mode off": "Kindermodus aus",
    "Home": "Start",
    "Look": "Aussehen",
    "Widgets": "Widgets",
    "Apps": "Apps",
    "Privacy and kids": "Datenschutz und Kinder",
    "Maintenance": "Wartung",
    "Frosted glass": "Milchglas",
    "Accent colour": "Akzentfarbe",
    "Background": "Hintergrund",
    "Landscapes": "Landschaften",
    "The focused cover": "Das markierte Cover",
    "Calm mode": "Ruhemodus",
    "Mint": "Minze",
    "Blue": "Blau",
    "Rose": "Rosa",
    "Amber": "Bernstein",
    "Hide from here": "Hier ausblenden",
    "Hidden apps": "Ausgeblendete Apps",
    "Show them all": "Alle zeigen",
    "None.": "Keine.",
    "LG privacy": "LG-Datenschutz",
    "ACR on ⚠": "ACR an ⚠",
    "ACR off ✓": "ACR aus ✓",
    "Looking at the TV…": "Schaue am Fernseher nach…",
    "Developer Mode: time left": "Entwicklermodus: Restzeit",
    "Renew Developer Mode by itself": "Entwicklermodus selbst erneuern",
    "Renew now": "Jetzt erneuern",
    "Close": "Schließen",
    "Asking LG…": "Frage bei LG nach…",
    "Update all": "Alle aktualisieren",
    "new versions": "neue Versionen",
    "Update": "Aktualisieren",
    "Update on this TV": "Auf diesem Fernseher aktualisieren",
    "Update apps by itself": "Apps automatisch aktualisieren",
    "Browse more apps": "Weitere Apps ansehen",
    "Do not turn the TV off. Back lets the update carry on.": "Fernseher nicht ausschalten. Zurück lässt das Update weiterlaufen.",
    "Could not update: ": "Aktualisieren nicht möglich: ",
    "Updated: ": "Aktualisiert: ",
    "Apps updated: ": "Apps aktualisiert: ",
    "Once a day the TV updates the apps you already installed.": "Einmal am Tag aktualisiert der Fernseher die schon installierten Apps.",
    "It needs the store permission: bash install.sh on the computer.": "Es braucht die Store-Erlaubnis: bash install.sh am Computer.",
    "Search": "Suchen",
    "Search again": "Neu suchen",
    "Pick the channel": "Kanal wählen",
    "added": "hinzugefügt",
    "already there": "schon da",
    "Remove from Continue watching": "Aus „Weiterschauen“ entfernen",
    "E.g. Bluey": "Z. B. Bluey",
    "Only on the LG TV": "Nur auf dem LG-Fernseher",
    "Type the channel name (or its @name) with the TV keyboard and press Enter.": "Gib den Kanalnamen (oder seinen @Namen) mit der Fernseh-Tastatur ein und drücke Enter.",
    "Move left": "Nach links",
    "Move right": "Nach rechts",
    "Remove": "Entfernen",
    "removed": "entfernt",
    "Bring back the removed ones": "Entfernte zurückholen",
    "Hold OK on a shortcut to move it or take it away.": "OK gedrückt halten auf einem Kanal: verschieben oder entfernen.",
    "Custom": "Eigene",
    "Continue watching": "Weiterschauen",
    "Add a channel": "Kanal hinzufügen",
    "Open": "Öffnen",
    "Uninstall": "Deinstallieren",
    "Cancel": "Abbrechen",
    "Nothing yet: what you open from here shows up here.": "Noch nichts: was du hier öffnest, erscheint hier.",
    "Places and picks": "Orte und Tipps",
    "Places": "Orte",
    "Picks": "Tipps",
    "Home Settings": "Startbildschirm",
    "TV Settings": "TV-Einstellungen",
    "HDMI Inputs": "HDMI-Eingänge",
    "Inputs": "Eingänge",
    "Shortcuts": "Verknüpfungen",
    "Weather": "Wetter",
    "No weather data right now.": "Gerade keine Wetterdaten.",
    "Sunrise ": "Sonnenaufgang ",
    "Sunset ": "Sonnenuntergang ",
    "Crypto": "Krypto",
    "24h change": "Änderung in 24 h",
    "For You": "Für dich",
    "Couldn't open ": "Konnte nicht öffnen: ",
    "Couldn't open TV Settings": "Die TV-Einstellungen ließen sich nicht öffnen",
    "Dollar": "Dollar",
    "Series": "Serie",
    "Language": "Sprache",
    "Temperature": "Temperatur",
    "Theme": "Design",
    "Automatic": "Automatisch",
    "Light": "Hell",
    "Dark": "Dunkel",
    "Weather widget": "Wetter-Widget",
    "Quotes widget": "Kurs-Widget",
    "On": "An",
    "Off": "Aus",
    "Shelf": "Leiste",
    "On · ": "In der Leiste · ",
    "OK or the arrows change the value.": "OK oder die Pfeiltasten ändern den Wert.",
    "OK adds or removes · ← → change the order": "OK fügt hinzu oder entfernt · ← → verschieben",
    "Explore": "Entdecken",
    "Movies": "Filme",
    "Shows": "Serien",
    "Clear": "Klar",
    "Mostly Sunny": "Überwiegend sonnig",
    "Mostly Clear": "Überwiegend klar",
    "Partly Cloudy": "Teilweise bewölkt",
    "Cloudy": "Bewölkt",
    "Fog": "Nebel",
    "Drizzle": "Nieselregen",
    "Heavy Rain": "Starker Regen",
    "Snow": "Schnee",
    "Thunderstorms": "Gewitter",
    "Rain": "Regen"
  };

  /** German by the English; text built at runtime by its English pattern. */
  function germanText(en) {
    if (Object.prototype.hasOwnProperty.call(german, en)) return german[en];
    var m = /^(\d+) (min|h|d) ago$/.exec(en);
    if (m) return 'vor ' + m[1] + (m[2] === 'min' ? ' Min.' : m[2] === 'h' ? ' Std.' : ' T.');
    m = /^(\d+) seasons?$/.exec(en);
    if (m) return m[1] + (m[1] === '1' ? ' Staffel' : ' Staffeln');
    m = /^H:(\S+)(\s+)L:(\S+)$/.exec(en);
    if (m) return 'H:' + m[1] + m[2] + 'T:' + m[3];
    m = /^The shelf holds up to (\d+) apps\.$/.exec(en);
    if (m) return 'In die Leiste passen bis zu ' + m[1] + ' Apps.';
    return en;
  }

  var russian = {
    "Live TV": "Телеканалы",
    "All Apps": "Приложения",
    "Settings": "Настройки",
    "Screensaver": "Заставка",
    "Search": "Найти",
    "Search again": "Искать снова",
    "Pick the channel": "Выберите канал",
    "added": "добавлен",
    "already there": "уже есть",
    "Remove from Continue watching": "Убрать из «Продолжить просмотр»",
    "E.g. Bluey": "Напр.: Bluey",
    "Only on the LG TV": "Только на телевизоре LG",
    "Type the channel name (or its @name) with the TV keyboard and press Enter.": "Введите название канала (или его @имя) с клавиатуры телевизора и нажмите Enter.",
    "Move left": "Влево",
    "Move right": "Вправо",
    "Remove": "Убрать",
    "removed": "убрано",
    "Bring back the removed ones": "Вернуть убранные",
    "Hold OK on a shortcut to move it or take it away.": "Удерживайте OK на ярлыке, чтобы переместить или убрать его.",
    "Custom": "Моё",
    "Continue watching": "Продолжить просмотр",
    "Add a channel": "Добавить канал",
    "Open": "Открыть",
    "Uninstall": "Удалить",
    "Cancel": "Отмена",
    "Nothing yet: what you open from here shows up here.": "Пока пусто: то, что вы откроете отсюда, появится здесь.",
    "Places and picks": "Места и подборки",
    "Places": "Места",
    "Picks": "Подборки",
    "Home Settings": "Главный экран",
    "TV Settings": "Настройки ТВ",
    "HDMI Inputs": "Входы HDMI",
    "Inputs": "Входы",
    "Shortcuts": "Ярлыки",
    "Weather": "Погода",
    "No weather data right now.": "Сейчас нет данных о погоде.",
    "Sunrise ": "Восход ",
    "Sunset ": "Закат ",
    "Crypto": "Криптовалюты",
    "24h change": "изменение за 24 ч",
    "For You": "Для вас",
    "Couldn't open ": "Не удалось открыть ",
    "Dollar": "Доллар",
    "Series": "Сериал",
    "now": "сейчас",
    "Language": "Язык",
    "Temperature": "Температура",
    "Theme": "Тема",
    "Automatic": "Автоматически",
    "Light": "Светлая",
    "Dark": "Тёмная",
    "Weather widget": "Виджет погоды",
    "Quotes widget": "Виджет котировок",
    "On": "Вкл.",
    "Off": "Выкл.",
    "Shelf": "Избранные приложения",
    "OK or the arrows change the value.": "Нажмите OK или стрелки, чтобы изменить значение.",
    "Explore": "Обзор",
    "Movies": "Фильмы",
    "Shows": "Сериалы",
    "Clear": "Ясно",
    "Mostly Sunny": "Малооблачно",
    "Mostly Clear": "Малооблачно",
    "Partly Cloudy": "Переменная облачность",
    "Cloudy": "Облачно",
    "Fog": "Туман",
    "Drizzle": "Морось",
    "Heavy Rain": "Сильный дождь",
    "Snow": "Снег",
    "Thunderstorms": "Гроза",
    "Rain": "Дождь",
    "On · ": "В избранном · ",
    "OK adds or removes · ← → change the order": "OK — добавить или убрать · ← → — изменить порядок",
    "Couldn't open TV Settings": "Не удалось открыть настройки телевизора",
    "Action & Adventure": "Боевик и приключения",
    "Sci-Fi & Fantasy": "Фантастика и фэнтези",
    "War & Politics": "Война и политика",
    "Kids": "Для детей",
    "News": "Новости",
    "Soap": "Мыльная опера",
    "Talk": "Ток-шоу",
    "": ""
  };

  function russianText(en) {
    if (Object.prototype.hasOwnProperty.call(russian, en)) return russian[en];
    var m = /^(\d+) (min|h|d) ago$/.exec(en);
    if (m) return m[1] + (m[2] === 'min' ? ' мин назад' : m[2] === 'h' ? ' ч назад' : ' дн. назад');
    m = /^The shelf holds up to (\d+) apps\.$/.exec(en);
    if (m) return 'В избранное можно добавить не более ' + m[1] + ' приложений.';
    return en;
  }

  function detect(setting) {
    var v = (setting || 'auto').toLowerCase();
    if (v === 'auto') v = (navigator.language || 'en').toLowerCase();
    return v.indexOf('ru') === 0 ? 'ru' : v.indexOf('de') === 0 ? 'de' : v.indexOf('pt') === 0 ? 'pt' : v.indexOf('es') === 0 ? 'es' : 'en';
  }

  return {
    set: function (setting) { lang = detect(setting); document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang; },
    count: function (n, one, few, many) {
      var last = Math.abs(n % 100);
      return n + ' ' + (last >= 11 && last <= 14 ? many : last % 10 === 1 ? one : last % 10 >= 2 && last % 10 <= 4 ? few : many);
    },
    get lang() { return lang; },
    tr: function (pt, en, es) { return lang === 'ru' ? russianText(en) : lang === 'de' ? germanText(en) : lang === 'es' ? (es || en) : lang === 'en' ? en : pt; },
    /** BCP 47 tag for dates, numbers and TMDB. */
    locale: function () { return lang === 'ru' ? 'ru-RU' : lang === 'de' ? 'de-DE' : lang === 'es' ? 'es-MX' : lang === 'en' ? 'en-US' : 'pt-BR'; }
  };
})();

function tr(pt, en, es) {
  return I18N.tr(pt, en, es);
}
