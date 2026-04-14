// Language switcher for pre-rendered multilingual pages.
// Reads window.__alternates populated at build time and navigates on click.

(function () {
  var alternates = window.__alternates || {};
  var current = window.__locale || document.documentElement.lang || 'en';

  var pills = document.querySelectorAll('[data-lang]');
  pills.forEach(function (el) {
    var target = el.dataset.lang;
    if (alternates[target]) {
      el.setAttribute('href', alternates[target]);
    }
    el.addEventListener('click', function (e) {
      // Let the browser navigate via the href attribute; just record choice.
      try { localStorage.setItem('homepot_lang', target); } catch (err) { /* no-op */ }
    });
  });

  // Mark current locale as active (extra safety on top of build-time classes)
  pills.forEach(function (el) {
    if (el.dataset.lang === current) {
      el.classList.add('text-darkBlue', 'font-semibold');
      el.classList.remove('text-darkBlue/40');
    }
  });
})();
