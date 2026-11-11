// Runtime i18n for utility pages that live at a single URL (404 + /join/ fallback,
// /reset-password/) and therefore choose their language in the browser.
//
// Build-time input (inline, before this script):
//   window.__HP_I18N = { defaultLocale: 'en', strings: { en: {...}, es: {...}, ... } }
// Optional hint (set by a page script before this one): window.__HP_LANG_HINT
//
// Markup conventions:
//   data-t="key"             -> textContent
//   data-t-aria-label="key"  -> aria-label
//   data-t-alt="key"         -> alt
//   data-lhref="/path/"      -> href with the locale prefix ('' for default, '/es' ...)
//   data-lsrc="...{lang}..." -> src with {lang} replaced
//   data-set-lang="xx"       -> language switch button (in-page, no navigation)
//
// Only textContent / attributes are ever set: strings are never parsed as HTML.

(function () {
  var cfg = window.__HP_I18N || {};
  var strings = cfg.strings || {};
  var fallback = cfg.defaultLocale || 'en';
  var listeners = [];

  function each(selector, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), fn);
  }

  function detect(hint) {
    if (hint && strings[hint]) return hint;
    var prefs = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || ''];
    for (var i = 0; i < prefs.length; i++) {
      var code = String(prefs[i] || '').toLowerCase().split('-')[0];
      if (strings[code]) return code;
    }
    return fallback;
  }

  var HP = {
    lang: detect(window.__HP_LANG_HINT),
    locales: Object.keys(strings),

    t: function (key) {
      var dict = strings[HP.lang] || {};
      if (dict[key] != null) return dict[key];
      var base = strings[fallback] || {};
      return base[key] != null ? base[key] : '';
    },

    // Set a translatable text and remember its key so language switches re-render it.
    setText: function (el, key) {
      if (!el) return;
      el.setAttribute('data-t', key);
      el.textContent = HP.t(key);
    },

    localePath: function (path) {
      return (HP.lang === fallback ? '' : '/' + HP.lang) + path;
    },

    apply: function () {
      document.documentElement.lang = HP.lang;
      each('[data-t]', function (el) { el.textContent = HP.t(el.getAttribute('data-t')); });
      each('[data-t-aria-label]', function (el) { el.setAttribute('aria-label', HP.t(el.getAttribute('data-t-aria-label'))); });
      each('[data-t-alt]', function (el) { el.setAttribute('alt', HP.t(el.getAttribute('data-t-alt'))); });
      each('[data-lhref]', function (el) { el.setAttribute('href', HP.localePath(el.getAttribute('data-lhref'))); });
      each('[data-lsrc]', function (el) { el.setAttribute('src', el.getAttribute('data-lsrc').replace('{lang}', HP.lang)); });
      each('[data-set-lang]', function (el) {
        var active = el.getAttribute('data-set-lang') === HP.lang;
        el.setAttribute('aria-pressed', active ? 'true' : 'false');
        el.classList.toggle('font-semibold', active);
        el.classList.toggle('text-darkBlue', active);
        el.classList.toggle('text-darkBlue/40', !active);
      });
    },

    setLang: function (lang) {
      if (!strings[lang] || lang === HP.lang) return;
      HP.lang = lang;
      HP.apply();
      listeners.forEach(function (fn) { fn(lang); });
    },

    onChange: function (fn) { listeners.push(fn); },

    // Called once, inline at the end of <body>, so the whole page is translated
    // before first paint and before any deferred script runs.
    mount: function () {
      each('[data-set-lang]', function (el) {
        el.addEventListener('click', function () { HP.setLang(el.getAttribute('data-set-lang')); });
      });
      HP.apply();
    },
  };

  document.documentElement.lang = HP.lang;
  window.HP = HP;
})();
