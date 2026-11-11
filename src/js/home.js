// Home page: the runway chart, the QR codes, the editable statement and the billing toggle.
// Ported from the approved landing (app repo: design/landing/app.js); the drawing is unchanged.
// What changed: every word and number format comes from the page, so one script serves the
// five languages.
//
// Build-time input (inline, before this script):
//   window.__HP_HOME = {
//     numberLocale: 'es-ES', currency: 'EUR', decimal: ',',
//     qr: { qr: url, qr2: url, qr3: url },             // one App Store link per QR code
//     t:  { today, lasts, noteShort, noteAll, noteUntil, spare, moreEach,
//           priceYear, perYear, priceMonth, perMonth }
//   }

(() => {
  'use strict';
  const CFG = window.__HP_HOME || {};
  const T = CFG.t || {};
  const LOCALE = CFG.numberLocale || 'es-ES';
  const CURRENCY = CFG.currency || 'EUR';
  const NS = 'http://www.w3.org/2000/svg';
  const NIGHT = '#0D1F17', LINE = '#0F4A30', BUTTER = '#F8D471', GRID = '#CAD8C7', AXIS = '#8CA68B', BAR = '#C0D2BE', TAG = '#155235';
  // Entrance motion is an enhancement: the chart is complete without it, and it never runs for reduced motion or automated captures.
  const MOTION = window.matchMedia('(prefers-reduced-motion: no-preference)').matches && !navigator.webdriver;
  // Axis labels: whole amounts in the page's currency (1.000 € · €1,000 · R$ 1.000).
  const axis = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0, useGrouping: 'always' });

  /* ---------- example household, November ---------- */
  const balance = [1108, 1045, 967, 885, 803, 707, 625, 525, 412.3, 383, 351, 319, 301, 283, 251, 219, 192, 169, 137, 114, 91, 68, 46, 23, 9, 0, 0, 0, 0, 0];
  const spend = [22, 40, 40, 40, 140, 60, 50, 52, 52, 56, 50, 50, 40, 150, 52, 60, 40, 50, 40, 92, 40, 60, 20, 8, 0, 0, 0, 0, 0, 0];
  const TODAY = 9, RUNS_OUT = 26;

  const el = (name, attrs, parent, text) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    parent.appendChild(n);
    return n;
  };

  // One outlined shape: the tail grows out of the box with concave sides and lands on the marker.
  const bubble = (x0, x1, y0, y1, cx, tipY, half) => {
    const ty = y1 + (tipY - y1) * 0.29;
    return `M${x0} ${y0}H${x1}V${y1}H${cx + half}C${cx + half * 0.46} ${y1} ${cx + half * 0.27} ${ty} ${cx} ${tipY}` +
      `C${cx - half * 0.27} ${ty} ${cx - half * 0.46} ${y1} ${cx - half} ${y1}H${x0}Z`;
  };

  // A callout keeps the comp's box. Only a longer sentence (another language) widens it.
  const fit = (textNode, compWidth, pad) => {
    let w = 0;
    try { w = textNode.getComputedTextLength(); } catch (e) { w = 0; }
    return Math.max(compWidth, Math.ceil(w + pad));
  };

  // Left-to-right wipe of the data layer (Web Animations, so captures can wait for it to finish).
  // Each cue lands when the wipe's edge reaches its x; the edge follows an ease-out cubic.
  function wipe(layer, cues) {
    if (!MOTION || !layer.animate) return;
    const DUR = 1700;
    const box = layer.getBBox();
    layer.animate([{ clipPath: 'inset(-12px 100% -12px -12px)' }, { clipPath: 'inset(-12px -12px -12px -12px)' }],
      { duration: DUR, easing: 'cubic-bezier(.33, 1, .68, 1)', fill: 'backwards' });
    cues.forEach(({ x, node, from }) => {
      const f = Math.min(1, Math.max(0, (x - box.x) / box.width));
      const delay = DUR * (1 - Math.cbrt(1 - f));
      node.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }],
        { duration: 600, delay, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' });
    });
  }

  function draw() {
    /* ---------- desktop runway chart (comp coordinates) ---------- */
    const svg = document.getElementById('runway');
    if (svg) {
      const X0 = 180.5, STEP = (1966 - 180.5) / 29, Y0 = 682, PER = 336 / 1200;
      const dx = (d) => X0 + (d - 1) * STEP;
      const vy = (v) => Y0 - v * PER;

      const grid = el('g', { stroke: GRID, 'stroke-width': 1.5 }, svg);
      const yl = el('g', { 'font-size': 22, 'font-weight': 500, fill: '#101512', 'text-anchor': 'end' }, svg);
      for (let k = 0; k <= 12; k++) {
        const v = k * 100, y = vy(v);
        el('line', { x1: 141, x2: 1992, y1: y, y2: y }, grid);
        el('text', { x: 134, y: y + 8 }, yl, axis.format(v));
      }
      el('line', { x1: 141, x2: 141, y1: vy(1200) - 6, y2: Y0, stroke: AXIS, 'stroke-width': 2 }, svg);
      el('line', { x1: 141, x2: 1992, y1: Y0, y2: Y0, stroke: AXIS, 'stroke-width': 2 }, svg);

      const data = el('g', {}, svg);
      const bars = el('g', { fill: BAR }, data);
      spend.forEach((s, i) => { if (s > 0) el('rect', { x: dx(i + 1) - 18, y: vy(s), width: 36, height: s * PER }, bars); });
      el('line', { x1: dx(TODAY), x2: dx(TODAY), y1: vy(balance[TODAY - 1]), y2: Y0, stroke: LINE, 'stroke-width': 2, 'stroke-dasharray': '6 6' }, data);
      el('polyline', { points: balance.map((v, i) => `${dx(i + 1)},${vy(v)}`).join(' '), fill: 'none', stroke: LINE, 'stroke-width': 5, 'stroke-linejoin': 'round' }, data);
      const dots = el('g', { stroke: LINE, 'stroke-width': 3.5, fill: '#FFFFFF' }, data);
      balance.forEach((v, i) => {
        const d = i + 1;
        if (d === RUNS_OUT) return;
        el('circle', { cx: dx(d), cy: vy(v), r: d === TODAY ? 11 : 7.5 }, dots);
      });

      const xl = el('g', { 'font-size': 21, 'font-weight': 500, fill: '#101512', 'text-anchor': 'middle' }, svg);
      for (let d = 1; d <= 30; d++) {
        if (d === TODAY || d === RUNS_OUT) {
          el('rect', { x: dx(d) - 23, y: 692, width: 46, height: 36, fill: TAG }, xl);
          el('text', { x: dx(d), y: 718, fill: '#FFFFFF', 'font-weight': 800 }, xl, String(d));
        } else {
          el('text', { x: dx(d), y: 718 }, xl, String(d));
        }
      }

      // callout: today (comp box 592…984; a longer sentence grows it to the right)
      const today = el('g', {}, svg);
      el('line', { x1: dx(TODAY), x2: dx(TODAY), y1: 478, y2: vy(balance[TODAY - 1]) - 11, stroke: LINE, 'stroke-width': 3 }, today);
      const tBox = el('rect', { x: 592, y: 420, width: 392, height: 56, fill: '#FFFFFF', stroke: LINE, 'stroke-width': 3 }, today);
      const tText = el('text', { x: 788, y: 458.5, 'text-anchor': 'middle', 'font-size': 27.1, 'font-weight': 800, fill: '#0A301F', style: 'font-stretch:108%' }, today, T.today);
      const tw = fit(tText, 392, 39);
      tBox.setAttribute('width', tw); tText.setAttribute('x', 592 + tw / 2);

      // callout: until when the pot lasts (box and tail are one outlined shape, as in the comp)
      const cx = dx(RUNS_OUT), cy = Y0, R = 10.5;
      const lasts = el('g', {}, svg);
      const lPath = el('path', { fill: BUTTER, stroke: NIGHT, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, lasts);
      const lText = el('text', { x: cx, y: 582.5, 'text-anchor': 'middle', 'font-size': 29.1, 'font-weight': 800, fill: '#0A0A08', style: 'font-stretch:108%' }, lasts, T.lasts);
      const lw = fit(lText, 398, 41);
      const lx = Math.min(cx - lw / 2, 1992 - lw);
      lPath.setAttribute('d', bubble(lx, lx + lw, 545, 599, cx, cy - R - 1.5, 13));
      lText.setAttribute('x', lx + lw / 2);
      const marker = el('circle', { cx, cy, r: R, fill: BUTTER, stroke: NIGHT, 'stroke-width': 3.5, style: 'transform-box:fill-box;transform-origin:center' }, svg);

      wipe(data, [
        { x: dx(TODAY), node: today, from: 'translateY(-10px)' },
        { x: cx, node: lasts, from: 'translateY(-14px)' },
        { x: cx, node: marker, from: 'scale(.3)' },
      ]);
    }

    /* ---------- mobile runway chart (same data, legible labels) ---------- */
    const m = document.getElementById('runway-m');
    if (m) {
      // 540-wide canvas: at phone width it renders ~0.66×, so 18-unit labels read at ~12 px.
      const L = 66, R = 528, T0 = 66, B = 330;
      const mx = (d) => L + (d - 1) * ((R - L) / 29), my = (v) => B - v * ((B - T0) / 1200);
      const g = el('g', { stroke: GRID, 'stroke-width': 1.2 }, m);
      const yt = el('g', { 'font-size': 17, 'font-weight': 500, fill: '#4C5A53', 'text-anchor': 'end' }, m);
      [0, 300, 600, 900, 1200].forEach((v) => { el('line', { x1: L, x2: R, y1: my(v), y2: my(v) }, g); el('text', { x: L - 7, y: my(v) + 6 }, yt, axis.format(v)); });
      el('line', { x1: L, x2: R, y1: B, y2: B, stroke: AXIS, 'stroke-width': 1.6 }, m);

      const data = el('g', {}, m);
      const mb = el('g', { fill: BAR }, data);
      spend.forEach((s, i) => { if (s > 0) el('rect', { x: mx(i + 1) - 5.5, y: my(s), width: 11, height: B - my(s) }, mb); });
      el('line', { x1: mx(TODAY), x2: mx(TODAY), y1: my(balance[TODAY - 1]), y2: B, stroke: LINE, 'stroke-width': 1.6, 'stroke-dasharray': '4 4' }, data);
      el('polyline', { points: balance.map((v, i) => `${mx(i + 1)},${my(v)}`).join(' '), fill: 'none', stroke: LINE, 'stroke-width': 4, 'stroke-linejoin': 'round' }, data);
      el('circle', { cx: mx(TODAY), cy: my(balance[TODAY - 1]), r: 7.5, fill: '#FFFFFF', stroke: LINE, 'stroke-width': 3.2 }, data);

      const xt = el('g', { 'font-size': 17, 'font-weight': 500, fill: '#4C5A53', 'text-anchor': 'middle' }, m);
      [1, 5, 15, 20, 30].forEach((d) => el('text', { x: mx(d), y: B + 27 }, xt, String(d)));
      [TODAY, RUNS_OUT].forEach((d) => { el('rect', { x: mx(d) - 16, y: B + 8, width: 32, height: 26, fill: TAG }, xt); el('text', { x: mx(d), y: B + 27, fill: '#FFFFFF', 'font-weight': 800 }, xt, String(d)); });

      const today = el('g', {}, m);
      el('line', { x1: mx(TODAY), x2: mx(TODAY), y1: 42, y2: my(balance[TODAY - 1]) - 8, stroke: LINE, 'stroke-width': 2.2 }, today);
      const tBox = el('rect', { y: 4, height: 38, fill: '#FFFFFF', stroke: LINE, 'stroke-width': 2.4 }, today);
      const tText = el('text', { y: 29.5, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 800, fill: '#0A301F', style: 'font-stretch:104%' }, today, T.today);
      const tw = Math.min(fit(tText, 270, 30), 532);
      const tx = Math.min(Math.max(4, mx(TODAY) - tw / 2), 536 - tw);
      tBox.setAttribute('x', tx); tBox.setAttribute('width', tw); tText.setAttribute('x', tx + tw / 2);

      const cx = mx(RUNS_OUT), r = 8.5;
      const lasts = el('g', {}, m);
      const lPath = el('path', { fill: BUTTER, stroke: NIGHT, 'stroke-width': 2, 'stroke-linejoin': 'round' }, lasts);
      const lText = el('text', { y: 240.5, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 800, fill: '#0A0A08', style: 'font-stretch:104%' }, lasts, T.lasts);
      const W = Math.min(fit(lText, 266, 30), 532);
      const x0 = Math.min(Math.max(cx - W / 2, 4), 536 - W);
      lPath.setAttribute('d', bubble(x0, x0 + W, 214, 254, cx, B - r - 1.5, 10));
      lText.setAttribute('x', x0 + W / 2);
      const marker = el('circle', { cx, cy: B, r, fill: BUTTER, stroke: NIGHT, 'stroke-width': 3, style: 'transform-box:fill-box;transform-origin:center' }, m);

      wipe(data, [
        { x: mx(TODAY), node: today, from: 'translateY(-8px)' },
        { x: cx, node: lasts, from: 'translateY(-10px)' },
        { x: cx, node: marker, from: 'scale(.3)' },
      ]);
    }
  }

  // The callouts are sized from their text, so the chart is drawn once the font is in.
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('800 27px Archivo'), document.fonts.load('500 22px Archivo')]).then(draw, draw);
  } else {
    draw();
  }

  /* ---------- QR codes to the App Store ---------- */
  if (typeof qrcode === 'function') {
    Object.keys(CFG.qr || {}).forEach((id) => {
      const box = document.getElementById(id);
      if (!box) return;
      const qr = qrcode(0, 'M');
      qr.addData(CFG.qr[id]);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    });
  }
})();

/* ---------- the editable statement and the billing toggle ---------- */
(() => {
  'use strict';
  const CFG = window.__HP_HOME || {};
  const T = CFG.t || {};
  const LOCALE = CFG.numberLocale || 'es-ES';
  const DEC = CFG.decimal || ',';
  const money = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CFG.currency || 'EUR', useGrouping: 'always' });
  const plain = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
  const $ = (id) => document.getElementById(id);
  // Reads a figure typed in the page's own format: everything but digits and its decimal mark is dropped.
  const num = (input) => {
    const raw = String(input.value).split(DEC);
    const whole = raw[0].replace(/\D/g, '');
    const frac = raw.length > 1 ? raw.slice(1).join('').replace(/\D/g, '') : '';
    const v = parseFloat(whole + (frac ? '.' + frac : ''));
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };
  const fill = (text, values) => String(text || '').replace(/\{(\w+)\}/g, (_, k) => (values[k] != null ? values[k] : ''));
  const people = $('sim-people');
  if (people) {
    const each = $('sim-each');
    const rows = [...document.querySelectorAll('.fig-in')];
    const steps = [...document.querySelectorAll('[data-step]')];
    const DAYS = 30, MIN = 1, MAX = 8;

    const set = (node, text) => {
      if (!node || node.textContent === text) return;
      node.textContent = text;
      node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash');
    };

    const calc = () => {
      const n = Math.min(MAX, Math.max(MIN, parseInt(people.value, 10) || MIN));
      steps.forEach((b) => { b.disabled = Number(b.dataset.step) < 0 ? n <= MIN : n >= MAX; });
      const pot = n * num(each);
      let fixed = 0, variable = 0;
      rows.forEach((r) => { if (r.dataset.kind === 'fixed') fixed += num(r); else variable += num(r); });
      const total = fixed + variable;
      set($('r-pot'), money.format(pot));
      set($('r-total'), money.format(total));
      const available = pot - fixed;
      let note;
      if (available <= 0) note = T.noteShort;
      else if (variable <= 0 || available >= variable) note = T.noteAll;
      else note = fill(T.noteUntil, { day: Math.max(1, Math.floor(available / (variable / DAYS))) });
      set($('r-note'), note);
      const diff = pot - total;
      set($('r-close'), diff >= 0 ? fill(T.spare, { amount: money.format(diff) }) : fill(T.moreEach, { amount: money.format(Math.ceil((-diff / n) * 100) / 100) }));
    };

    steps.forEach((b) => b.addEventListener('click', () => {
      const v = Math.min(MAX, Math.max(MIN, (parseInt(people.value, 10) || MIN) + Number(b.dataset.step)));
      people.value = String(v);
      $('sim-people-out').textContent = String(v);
      calc();
    }));
    [each, ...rows].forEach((f) => {
      f.addEventListener('input', calc);
      f.addEventListener('blur', () => { if (f !== each) f.value = plain.format(num(f)); });
      f.addEventListener('focus', () => f.select());
    });
    calc();
  }

  const bill = document.querySelectorAll('[data-billing]');
  bill.forEach((b) => b.addEventListener('click', () => {
    bill.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const year = b.dataset.billing === 'year';
    $('pro-price').textContent = year ? T.priceYear : T.priceMonth;
    $('pro-per').textContent = year ? T.perYear : T.perMonth;
  }));
})();
