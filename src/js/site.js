// Shared site-wide behaviors: scroll reveal, navbar shadow, pricing toggle, email signup.

(function () {
  // 1. Scroll Reveal
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealEls.forEach(function (el) { el.classList.add('visible'); });
    } else {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            revealObserver.unobserve(e.target);
          }
        });
      }, { threshold: 0.1 });
      revealEls.forEach(function (el) { revealObserver.observe(el); });
    }
  }

  // 2. Navbar scroll shadow
  var navbar = document.querySelector('[data-navbar]');
  if (navbar) {
    window.addEventListener('scroll', function () {
      navbar.classList.toggle('shadow-sm', window.scrollY > 50);
    });
  }

  // 3. Pricing toggle (home only)
  var pricingToggle = document.querySelector('[data-pricing-toggle]');
  if (pricingToggle) {
    var isAnnual = true;
    pricingToggle.addEventListener('click', function () {
      isAnnual = !isAnnual;
      pricingToggle.setAttribute('aria-checked', String(isAnnual));
      var knob = pricingToggle.querySelector('span');
      if (knob) {
        knob.classList.toggle('translate-x-5', isAnnual);
        knob.classList.toggle('translate-x-0', !isAnnual);
      }
      pricingToggle.classList.toggle('bg-terracotta', isAnnual);
      pricingToggle.classList.toggle('bg-gray-300', !isAnnual);
      document.querySelectorAll('[data-price-monthly]').forEach(function (el) {
        el.classList.toggle('hidden', isAnnual);
        if (!isAnnual) el.classList.add('flex'); else el.classList.remove('flex');
      });
      document.querySelectorAll('[data-price-annual]').forEach(function (el) {
        el.classList.toggle('hidden', !isAnnual);
        if (isAnnual) el.classList.add('flex'); else el.classList.remove('flex');
      });
    });
  }

  // 4. Email form → Supabase promo-signup edge function
  var emailForm = document.getElementById('email-form');
  if (emailForm) {
    var endpoint = emailForm.dataset.promoEndpoint;
    emailForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var input = document.getElementById('email-input');
      var btn = document.getElementById('email-btn');
      var successEl = document.getElementById('email-success');
      var errorEl = document.getElementById('email-error');
      var email = input && input.value.trim();
      if (!email || !endpoint) return;

      var defaultLabel = btn ? (btn.dataset.labelDefault || btn.textContent) : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = '...';
      }
      if (errorEl) errorEl.classList.add('hidden');

      try {
        var res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email })
        });
        if (!res.ok) throw new Error('Failed');
        emailForm.classList.add('hidden');
        if (successEl) successEl.classList.remove('hidden');
      } catch (err) {
        if (errorEl) errorEl.classList.remove('hidden');
        if (btn) {
          btn.disabled = false;
          btn.textContent = defaultLabel;
        }
      }
    });
  }
})();
