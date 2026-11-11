// /join/?c=CODE — the invite link the app shares (CODE = 12 lower-case hex characters).
//
// With the app installed, Universal Links (iOS) / App Links (Android) open it directly
// and this page never loads. Otherwise it offers «Open in the app» (custom scheme) and
// the store, and copies the invite link when a store button is tapped, so the person can
// paste it in the app once it is installed («I have an invitation»).
//
// Loaded in <head> (blocking, tiny) so the right state is chosen before first paint:
//   html.hp-code   → a valid code is present
//   (no class)     → neutral «open the app» page, which is also the no-JS fallback
//
// Build-time input: window.__HP_JOIN = { inviteBase: 'https://homepotapp.com/join/?c=' }

(function () {
  var cfg = window.__HP_JOIN || {};
  var code = '';

  try {
    var raw = new URLSearchParams(window.location.search).get('c') || '';
    // Lenient on case, strict on charset: [a-z0-9], at most 32 characters.
    code = raw.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
  } catch (e) { code = ''; }

  var title = document.querySelector('title');
  if (code) {
    document.documentElement.classList.add('hp-code');
  } else if (title) {
    title.setAttribute('data-t', 'join.nocode_title');
  }

  var inviteLink = code ? (cfg.inviteBase || (window.location.origin + '/join/?c=')) + code : '';

  // Synchronous copy: it has to finish inside the tap, before the store takes over the screen.
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
    if (legacyCopy(text)) return Promise.resolve(true);
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return false; }
      );
    }
    return Promise.resolve(false);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var HP = window.HP;
    var openEl = document.getElementById('join-open');
    var codeEl = document.getElementById('join-code');
    var hint = document.getElementById('join-copy-hint');
    var copied = document.getElementById('join-copied');
    var failed = document.getElementById('join-copy-failed');

    if (!code) return;

    if (codeEl) codeEl.textContent = code;
    if (openEl) openEl.setAttribute('href', (openEl.getAttribute('data-scheme') || 'homepot://') + 'join/' + encodeURIComponent(code));

    function announce(box, key) {
      if (!box) return;
      box.hidden = false;
      // Re-set the text so screen readers announce the live region.
      var text = box.querySelector('[data-t]');
      if (text && HP) HP.setText(text, key);
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-store]'), function (link) {
      link.addEventListener('click', function () {
        // The link itself is not prevented: the store opens while the copy has already happened.
        copyText(inviteLink).then(function (ok) {
          if (hint) hint.hidden = true;
          if (copied) copied.hidden = !ok;
          if (failed) failed.hidden = ok;
          announce(ok ? copied : failed, ok ? 'join.copied' : 'join.copy_failed');
        });
      });
    });
  });
})();
