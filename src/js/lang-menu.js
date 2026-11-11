// Language menu of the header band (a native <details>): closes on an outside
// click and on Escape, which returns focus to the summary. Same behaviour as the landing.

(function () {
  var lang = document.querySelector('.lang');
  if (!lang) return;
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
