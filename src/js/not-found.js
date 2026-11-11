// 404 page. GitHub Pages serves /404.html for every unknown path, so this page
// also acts as the fallback for group invite links (/join/CODE) when the app is
// not installed (with the app installed, Universal / App Links open it directly).
//
// Loaded in <head> (blocking, tiny) so the right view is chosen before first paint.

(function () {
  var path = window.location.pathname || '/';
  var code = '';

  var match = path.match(/^\/join\/([^\/]+)/);
  if (match) {
    var raw = match[1];
    try { raw = decodeURIComponent(raw); } catch (e) { /* keep raw */ }
    // Invite codes are 12 lowercase hex chars; be lenient but strict on charset.
    code = raw.replace(/[^A-Za-z0-9]/g, '').slice(0, 32);
  }

  if (code) {
    document.documentElement.classList.add('hp-join');
    var title = document.querySelector('title');
    if (title) title.setAttribute('data-t', 'join.title');
  } else {
    // Regular 404: honour a locale prefix in the URL (/es/..., /fr/...).
    var strings = (window.__HP_I18N && window.__HP_I18N.strings) || {};
    var prefix = path.match(/^\/([a-z]{2})(\/|$)/);
    if (prefix && strings[prefix[1]]) window.__HP_LANG_HINT = prefix[1];
    return;
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { ta.setSelectionRange(0, text.length); } catch (e) { /* iOS quirk */ }
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return legacyCopy(text); }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  document.addEventListener('DOMContentLoaded', function () {
    var HP = window.HP;
    var codeEl = document.getElementById('join-code');
    var openEl = document.getElementById('join-open');
    var copyBtn = document.getElementById('join-copy');
    var copyLabel = document.getElementById('join-copy-label');
    var copyIcon = document.getElementById('join-copy-icon');
    var copyStatus = document.getElementById('join-copy-status');
    var copyError = document.getElementById('join-copy-error');
    var resetTimer = null;

    if (codeEl) codeEl.textContent = code;
    if (openEl) openEl.setAttribute('href', (openEl.getAttribute('data-base') || 'homepot://join/') + encodeURIComponent(code));

    function selectCode() {
      if (!codeEl || !window.getSelection) return;
      var range = document.createRange();
      range.selectNodeContents(codeEl);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    function resetCopyButton() {
      HP.setText(copyLabel, 'join.copy_code');
      if (copyIcon) copyIcon.textContent = 'content_copy';
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        copyText(code).then(function (ok) {
          copyBtn.focus();
          if (ok) {
            if (copyError) copyError.hidden = true;
            HP.setText(copyLabel, 'join.copied');
            HP.setText(copyStatus, 'join.copied');
            if (copyIcon) copyIcon.textContent = 'check';
            clearTimeout(resetTimer);
            resetTimer = setTimeout(function () {
              resetCopyButton();
              if (copyStatus) { copyStatus.removeAttribute('data-t'); copyStatus.textContent = ''; }
            }, 2000);
          } else {
            HP.setText(copyError, 'join.copy_failed');
            if (copyError) copyError.hidden = false;
            selectCode();
          }
        });
      });
    }
  });
})();
