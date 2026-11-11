// /reset-password/ — completes a Supabase password recovery in the browser.
//
// The app sends recovery emails that land here. Supported link formats, checked
// in this order:
//   a) ?error=… / #error=…&error_code=otp_expired…     -> invalid / expired link
//   b) ?token_hash=…&type=recovery                      -> auth.verifyOtp()
//   c) ?code=…  (PKCE)                                   -> auth.exchangeCodeForSession()
//                                                         (fails without the verifier, i.e.
//                                                         when the flow started in the app)
//   d) #access_token=…&refresh_token=…&type=recovery    -> auth.setSession()  (implicit flow,
//                                                         what the app produces today)
//   e) anything else                                     -> invalid link
//
// Tokens are removed from the address bar right after being read. The session
// only lives in memory (persistSession: false) and is revoked after success.
//
// Depends on: window.HP (utility-i18n.js), window.supabase (supabase-js UMD),
// window.__HP_SUPABASE = { url, anonKey } (inlined at build time).

(function () {
  var HP = window.HP;
  var cfg = window.__HP_SUPABASE || {};

  // Password policy (mirrors the Supabase project setting: min 6 chars +
  // lowercase, uppercase, digit and symbol). Symbol set = Supabase's list.
  var MIN_LENGTH = 6;
  var SYMBOL_RE = /[!@#$%^&*()_+\-=\[\]{};':"\\|<>?,.\/`~]/;
  var RULES = {
    length: function (pw) { return pw.length >= MIN_LENGTH; },
    lower: function (pw) { return /[a-z]/.test(pw); },
    upper: function (pw) { return /[A-Z]/.test(pw); },
    digit: function (pw) { return /[0-9]/.test(pw); },
    symbol: function (pw) { return SYMBOL_RE.test(pw); },
    match: function (pw, confirm) { return pw.length > 0 && pw === confirm; },
  };

  var views = {};
  ['loading', 'invalid', 'form', 'success'].forEach(function (name) {
    views[name] = document.querySelector('[data-view="' + name + '"]');
  });

  function $(id) { return document.getElementById(id); }

  function show(name) {
    Object.keys(views).forEach(function (key) {
      if (views[key]) views[key].hidden = key !== name;
    });
  }

  function showProblem(kind) {
    HP.setText($('rp-problem-title'), 'rp.' + kind + '_title');
    HP.setText($('rp-problem-body'), 'rp.' + kind + '_body');
    show('invalid');
  }

  // ---------------------------------------------------------------- 1. read URL
  var query = new URLSearchParams(window.location.search);
  var hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  function param(name) { return query.get(name) || hash.get(name); }

  var linkError = param('error') || param('error_code') || param('error_description');
  var tokenHash = param('token_hash');
  var type = param('type');
  var code = query.get('code');
  var accessToken = hash.get('access_token');
  var refreshToken = hash.get('refresh_token');

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    // supabase-js failed to load: keep the tokens in the URL so a reload can retry.
    showProblem('load');
    return;
  }

  // ------------------------------------------------- 2. strip tokens from the URL
  if (window.location.search || window.location.hash) {
    try { window.history.replaceState(null, '', window.location.pathname); } catch (e) { /* ignore */ }
  }

  var client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { detectSessionInUrl: false, persistSession: false, autoRefreshToken: false },
  });

  function isNetworkError(err) {
    return !!err && (err.name === 'AuthRetryableFetchError' || err.status === 0 || err instanceof TypeError);
  }

  function establishSession() {
    var isRecovery = !type || type === 'recovery';
    if (linkError) return Promise.resolve({ invalid: true });
    if (tokenHash) {
      return isRecovery
        ? client.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        : Promise.resolve({ invalid: true });
    }
    if (code) return client.auth.exchangeCodeForSession(code);
    if (accessToken && refreshToken) {
      return isRecovery
        ? client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        : Promise.resolve({ invalid: true });
    }
    return Promise.resolve({ invalid: true });
  }

  // ------------------------------------------------------------- 3. form logic
  var form = $('rp-form');
  var pwInput = $('rp-password');
  var confirmInput = $('rp-confirm');
  var submitBtn = $('rp-submit');
  var submitLabel = $('rp-submit-label');
  var errorEl = $('rp-error');
  var busy = false;

  function evaluate() {
    var pw = pwInput.value;
    var confirm = confirmInput.value;
    var result = {};
    Object.keys(RULES).forEach(function (rule) { result[rule] = RULES[rule](pw, confirm); });
    return result;
  }

  function renderRules() {
    var result = evaluate();
    Array.prototype.forEach.call(document.querySelectorAll('[data-rule]'), function (li) {
      var ok = !!result[li.getAttribute('data-rule')];
      li.setAttribute('data-ok', ok ? 'true' : 'false');
      var icon = li.querySelector('.hp-rule-icon');
      if (icon) icon.textContent = ok ? 'check_circle' : 'radio_button_unchecked';
      HP.setText(li.querySelector('[data-rule-state]'), ok ? 'rp.rule_ok' : 'rp.rule_missing');
    });
    return result;
  }

  function setError(key) {
    if (!errorEl) return;
    if (!key) {
      errorEl.hidden = true;
      errorEl.removeAttribute('data-t');
      errorEl.textContent = '';
      return;
    }
    HP.setText(errorEl, key);
    errorEl.hidden = false;
  }

  function setBusy(value) {
    busy = value;
    submitBtn.disabled = value;
    submitBtn.setAttribute('aria-busy', value ? 'true' : 'false');
    HP.setText(submitLabel, value ? 'rp.submitting' : 'rp.submit');
  }

  function mapUpdateError(err) {
    var code = (err && err.code) || '';
    var status = err && err.status;
    var name = (err && err.name) || '';
    var message = String((err && err.message) || '').toLowerCase();
    if (code === 'same_password' || message.indexOf('different from the old password') !== -1) return 'rp.err_same';
    if (code === 'weak_password' || name === 'AuthWeakPasswordError') return 'rp.err_weak';
    if (status === 429 || code === 'over_request_rate_limit') return 'rp.err_rate';
    if (
      name === 'AuthSessionMissingError' ||
      ['session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used',
        'bad_jwt', 'no_authorization', 'user_not_found', 'reauthentication_needed'].indexOf(code) !== -1 ||
      status === 401 || status === 403
    ) return 'rp.err_session';
    return 'rp.err_generic';
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-toggle-password]'), function (btn) {
    var input = $(btn.getAttribute('data-toggle-password'));
    var icon = btn.querySelector('.material-symbols-outlined');
    btn.addEventListener('click', function () {
      var reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      btn.setAttribute('aria-pressed', reveal ? 'true' : 'false');
      if (icon) icon.textContent = reveal ? 'visibility_off' : 'visibility';
    });
  });

  pwInput.addEventListener('input', function () { renderRules(); setError(null); });
  confirmInput.addEventListener('input', function () { renderRules(); setError(null); });
  HP.onChange(renderRules);
  renderRules();

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (busy) return;

    var result = renderRules();
    if (!(result.length && result.lower && result.upper && result.digit && result.symbol)) {
      setError('rp.err_rules');
      pwInput.focus();
      return;
    }
    if (!result.match) {
      setError('rp.err_mismatch');
      confirmInput.focus();
      return;
    }

    setError(null);
    setBusy(true);
    client.auth.updateUser({ password: pwInput.value })
      .then(function (res) {
        if (res && res.error) throw res.error;
        pwInput.value = '';
        confirmInput.value = '';
        show('success');
        var heading = $('rp-success-title');
        if (heading) heading.focus();
        // Revoke the recovery session; the user signs in again in the app.
        client.auth.signOut({ scope: 'local' }).catch(function () { /* ignore */ });
      })
      .catch(function (err) {
        setError(mapUpdateError(err));
      })
      .then(function () { setBusy(false); });
  });

  // ------------------------------------------------------- 4. verify the link
  establishSession()
    .then(function (res) {
      if (!res || res.invalid) return showProblem('invalid');
      if (res.error) return showProblem(isNetworkError(res.error) ? 'network' : 'invalid');
      if (!res.data || !res.data.session) return showProblem('invalid');
      var user = res.data.user || res.data.session.user;
      if (user && user.email && $('rp-username')) $('rp-username').value = user.email;
      show('form');
      pwInput.focus();
    })
    .catch(function (err) {
      showProblem(isNetworkError(err) ? 'network' : 'invalid');
    });
})();
