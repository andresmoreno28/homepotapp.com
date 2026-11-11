// Language menu of the header band (a native <details>): closes on an outside
// click and on Escape, which returns focus to the summary. Same behaviour as the landing.

(function () {
  var lang = document.querySelector('.lang');
  if (!lang) return;

  // On a page that exists once per language, reading it in a language is a choice: remember it
  // for the pages that pick theirs in the browser (help, privacy, terms, invite…).
  if (lang.querySelector('a[hreflang]')) {
    try { window.localStorage.setItem('homepot_lang', document.documentElement.lang); } catch (e) { /* private mode */ }
  }
  document.addEventListener('click', function (e) {
    if (lang.open && !lang.contains(e.target)) lang.open = false;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lang.open) {
      lang.open = false;
      var summary = lang.querySelector('summary');
      if (summary) summary.focus();
    }
  });
})();
