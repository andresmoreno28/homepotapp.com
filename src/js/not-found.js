// 404 page. GitHub Pages serves /404.html for every unknown path.
//
// Loaded in <head> (blocking, tiny) so it runs before first paint:
// - Legacy invite links /join/CODE (what the app shared before /join/?c=CODE) are sent to
//   the real invite page, which answers 200 and can show a link preview.
// - Any other path is a regular 404; a locale prefix in the URL (/es/…, /fr/…) picks the language.

(function () {
  var path = window.location.pathname || '/';

  var legacy = path.match(/^\/join\/([A-Za-z0-9]{1,32})\/?$/);
  if (legacy) {
    document.documentElement.classList.add('hp-redirect'); // nothing flashes while we leave
    window.location.replace('/join/?c=' + legacy[1].toLowerCase());
    return;
  }

  var strings = (window.__HP_I18N && window.__HP_I18N.strings) || {};
  var prefix = path.match(/^\/([a-z]{2})(\/|$)/);
  if (prefix && strings[prefix[1]]) window.__HP_LANG_HINT = prefix[1];
})();
