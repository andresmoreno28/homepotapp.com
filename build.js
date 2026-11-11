import { Eta } from 'eta';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import config from './build.config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SRC = join(ROOT, 'src');

// ------------- helpers -------------
function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeFile(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// JSON safe to inline inside a <script> element
function inlineJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// { a: { b: 'x' } } -> { 'prefix.a.b': 'x' }
function flatten(prefix, obj, out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(path, value, out);
    else out[path] = value;
  }
  return out;
}

function localePrefix(locale) {
  return locale === config.defaultLocale ? '' : `/${locale}`;
}

function absoluteUrl(locale, route) {
  return `${config.baseUrl}${localePrefix(locale)}${route}`;
}

function outPath(locale, route) {
  // route starts with '/' and ends with '/'
  const rel = `${localePrefix(locale)}${route}index.html`;
  return join(ROOT, rel);
}

// Absolute URLs for hreflang / canonical / og
function buildAlternatesAbs(route) {
  const alternates = {};
  for (const loc of config.locales) {
    alternates[loc] = `${config.baseUrl}${localePrefix(loc)}${route}`;
  }
  return alternates;
}

// ------------- measurement hooks (off by default, see build.config.js) -------------
// Every App Store link on the site is built here. With appStore.providerToken set it
// carries Apple's campaign parameters (pt = provider, ct = placement, mt = 8) so App Store
// Connect > Analytics > Sources shows which button the download came from.
function appStoreLink(placement) {
  const token = String(config.appStore?.providerToken || '').trim();
  if (!token) return config.appStoreUrl;
  const sep = config.appStoreUrl.includes('?') ? '&' : '?';
  return `${config.appStoreUrl}${sep}pt=${encodeURIComponent(token)}&ct=${encodeURIComponent(placement)}&mt=8`;
}

// QR codes carry the short form of the store link (…/app/id123), as on the landing: fewer
// characters make a coarser code, which is what a phone can read off a screen.
function appStoreQrLink(placement) {
  const id = (config.appStoreUrl.match(/id\d+/) || [])[0];
  const base = id ? `https://apps.apple.com/app/${id}` : config.appStoreUrl;
  const token = String(config.appStore?.providerToken || '').trim();
  return token ? `${base}?pt=${encodeURIComponent(token)}&ct=${encodeURIComponent(placement)}&mt=8` : base;
}

// HTML-attribute-safe version for templates (autoEscape is off).
function appStoreHref(placement) {
  if (placement.length > 40) console.warn(`  warning: campaign token "${placement}" is longer than Apple's 40 characters`);
  return escapeHtml(appStoreLink(placement));
}

// Cloudflare Web Analytics beacon (cookieless). Empty string while the token is empty.
function analyticsSnippet() {
  // The token is 32 hex characters; anything else is dropped so it can sit raw in the attribute.
  const token = String(config.analytics?.cloudflareToken || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!token) return '';
  return `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${token}"}'></script>`;
}

// Link preview image, one per language (og-image.png is the default locale's).
const OG_IMAGE_VERSION = 4;
function ogImageUrl(locale) {
  const suffix = locale === config.defaultLocale ? '' : `-${locale}`;
  return `${config.baseUrl}/og-image${suffix}.png?v=${OG_IMAGE_VERSION}`;
}

// ------------- identity -------------
// Language menu, in the landing's order, with native names.
const LANG_NAMES = { es: 'Español', en: 'English', pt: 'Português', fr: 'Français', de: 'Deutsch' };
const LANG_ORDER = Object.keys(LANG_NAMES).filter((code) => config.locales.includes(code));

// Drawn icons (strokes in currentColor). Apple, Android and scissors are the landing's own.
const icons = {
  apple: '<svg viewBox="0 0 24 28" aria-hidden="true"><path fill="currentColor" d="M19.7 14.9c0-3 2.5-4.5 2.6-4.6-1.4-2.1-3.6-2.4-4.4-2.4-1.9-.2-3.7 1.1-4.6 1.1-1 0-2.4-1.1-4-1.1-2 0-3.9 1.2-5 3-2.1 3.7-.5 9.2 1.5 12.2 1 1.4 2.2 3.1 3.7 3 1.5-.1 2.1-1 3.9-1s2.3 1 3.9.9c1.6 0 2.6-1.4 3.6-2.9 1.1-1.7 1.6-3.3 1.6-3.4-.1 0-3.2-1.2-2.8-4.8zM16.8 5.8c.8-1 1.4-2.4 1.2-3.8-1.2.1-2.6.8-3.5 1.8-.8.9-1.4 2.3-1.2 3.6 1.3.1 2.7-.7 3.5-1.6z"/></svg>',
  android: '<svg viewBox="0 0 56 64" aria-hidden="true"><path fill="currentColor" d="M14 22h28v26a4 4 0 0 1-4 4h-2v8a4 4 0 0 1-8 0v-8h-4v8a4 4 0 0 1-8 0v-8h-2a4 4 0 0 1-4-4zM5 24a4 4 0 0 1 8 0v16a4 4 0 0 1-8 0zM43 24a4 4 0 0 1 8 0v16a4 4 0 0 1-8 0zM14 19c0-6 5-11 11-12l-3-5 1.5-1 3.3 5.4a14 14 0 0 1 2.4 0L32.5 1 34 2l-3 5c6 1 11 6 11 12zm8-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>',
  scissors: '<svg viewBox="0 0 44 36" fill="none" stroke="currentColor" stroke-width="3"><circle cx="9" cy="9" r="6"/><circle cx="9" cy="27" r="6"/><path d="M14 12 42 30M14 24 42 6"/></svg>',
  // The brand symbol «recibo-casa», cropped to its ink so it sits like the Apple mark does.
  symbol: '<svg viewBox="17 13 66 78" fill="none" stroke="currentColor" aria-hidden="true"><path d="M22 86V43L50 18l28 25v43l-5.6-5-5.6 5-5.6-5-5.6 5-5.6-5-5.6 5-5.6-5-5.6 5-5.6-5z" stroke-width="7.5" stroke-linejoin="round"/><path d="M36 54h28M36 66h18" stroke-width="7" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5 10 18 19.5 6.5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 4.5v10M12 19.4v.1"/></svg>',
  eye: '<svg class="eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
  eyeOff: '<svg class="eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/><path d="M4.5 4.5l15 15"/></svg>',
  ruleMark: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect class="mark-todo" x="4" y="4" width="12" height="12" stroke-width="1.8"/><path class="mark-ok" d="M3.5 10.5 8 15 16.5 5" stroke-width="2.6"/></svg>',
  // The landing's plus that folds into a minus when a question opens.
  plus: '<svg class="pm" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12"/><path class="pm-v" d="M10 4v12"/></svg>',
  star: '<svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M10 1.6l2.5 5.4 5.9.7-4.4 4 1.2 5.8L10 14.6l-5.2 2.9L6 11.7l-4.4-4 5.9-.7z"/></svg>',
};

// src/styles/<name>.css → /assets/<name>.css, linked with a content hash.
function buildCss(name) {
  const css = readFileSync(join(SRC, 'styles', `${name}.css`), 'utf8');
  writeFile(join(ROOT, 'assets', `${name}.css`), css);
  console.log(`✓ assets/${name}.css`);
  return `/assets/${name}.css?v=${createHash('sha1').update(css).digest('hex').slice(0, 8)}`;
}

// ------------- load data -------------
const i18n = {};
for (const loc of config.locales) {
  i18n[loc] = loadJson(join(SRC, 'i18n', `${loc}.json`));
}
// Text of the three hand-written pages (support, privacy, terms): { en: { 'support.title': … }, … }
const legal = loadJson(join(SRC, 'i18n', 'pages-translations.json'));

const comparisons = loadJson(join(SRC, 'data', 'comparisons.json'));
const tools = loadJson(join(SRC, 'data', 'tools.json'));
const guides = loadJson(join(SRC, 'data', 'guides.json'));

// ------------- init eta -------------
const eta = new Eta({
  views: join(SRC, 'templates'),
  autoEscape: false,
  cache: false,
});

function render(template, ctx) {
  return eta.render(template, ctx);
}

function renderWithLayout(template, ctx) {
  const body = render(template, ctx);
  return render('_layout', { ...ctx, body });
}

// ------------- routes collector -------------
const routes = [];
function registerRoute(route, locale) {
  routes.push({ route, locale, canonical: absoluteUrl(locale, route) });
}

// ------------- money: the examples follow each language's number format and currency -------------
function moneyOf(locale) {
  const { numberLocale, currency } = i18n[locale].meta;
  const money = new Intl.NumberFormat(numberLocale, { style: 'currency', currency, useGrouping: 'always' });
  const plain = new Intl.NumberFormat(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
  // «650 €» · «€650» · «R$ 650»: what goes before and after a figure the visitor can edit
  const parts = money.formatToParts(1);
  const first = parts.findIndex((part) => part.type === 'integer');
  const last = parts.map((part) => part.type).lastIndexOf('fraction');
  const text = (list) => list.map((part) => part.value).join('');
  return {
    numberLocale,
    currency,
    decimal: parts.find((part) => part.type === 'decimal').value,
    prefix: text(parts.slice(0, first)),
    suffix: text(parts.slice(last + 1)),
    format: (value) => money.format(value),
    plain: (value) => plain.format(value),
  };
}

// The statement's starting figures, worked out exactly as src/js/home.js does, so the page
// already shows what the script would write (no flash on load).
function statementDefaults(locale) {
  const m = moneyOf(locale);
  const t = i18n[locale].pages.home.sim;
  const people = 2, each = 650, days = 30;
  const rows = [
    { id: 'rent', kind: 'fixed', amount: 950 },
    { id: 'food', kind: 'var', amount: 320 },
    { id: 'power', kind: 'fixed', amount: 64.2 },
    { id: 'net', kind: 'fixed', amount: 35 },
    { id: 'other', kind: 'var', amount: 88.9 },
  ];
  const sum = (kind) => rows.filter((row) => row.kind === kind).reduce((total, row) => total + row.amount, 0);
  const pot = people * each, fixed = sum('fixed'), variable = sum('var'), total = fixed + variable;
  const available = pot - fixed;
  const note = available <= 0 ? t.note_short
    : variable <= 0 || available >= variable ? t.note_all
      : t.note_until.replace('{day}', Math.max(1, Math.floor(available / (variable / days))));
  const diff = pot - total;
  const close = diff >= 0 ? t.spare.replace('{amount}', m.format(diff))
    : t.more_each.replace('{amount}', m.format(Math.ceil((-diff / people) * 100) / 100));
  return {
    each: String(each),
    rows: rows.map((row) => ({ id: row.id, kind: row.kind, value: m.plain(row.amount) })),
    pot: m.format(pot),
    total: m.format(total),
    note,
    close,
  };
}

// ------------- context of every page that exists once per language -------------
function pageCtx(locale, route, { title, description, ogType = 'website', jsonLd, cssHref }) {
  const bundle = i18n[locale];
  const home = bundle.pages.home;
  const prefix = localePrefix(locale);
  return {
    locale,
    defaultLocale: config.defaultLocale,
    prefix,
    homeHref: `${prefix}/`,
    baseUrl: config.baseUrl,
    contactEmail: config.contactEmail,
    pageTitle: title,
    pageDescription: description,
    canonicalUrl: absoluteUrl(locale, route),
    alternatesAbs: buildAlternatesAbs(route),
    ogLocale: bundle.meta.ogLocale,
    ogLocaleAlternates: config.locales.filter((loc) => loc !== locale).map((loc) => i18n[loc].meta.ogLocale),
    ogImage: ogImageUrl(locale),
    ogType,
    jsonLd,
    jsonLdJson: jsonLd ? inlineJson(jsonLd) : '',
    cssHref,
    langs: LANG_ORDER.map((code) => ({ code, name: LANG_NAMES[code], href: `${localePrefix(code)}${route}` })),
    langLabel: home.lang_label,
    nav: home.nav,
    brand: { language: bundle.ui.nav.language, ...bundle.ui.brand },
    store: home.store,
    slip: { title: home.close.title, text: home.close.text, slot: 'cta' },
    appStore: (slot) => appStoreHref(`web-${locale}-${slot}`),
    appStoreQr: (slot) => appStoreQrLink(`web-${locale}-${slot}`),
    playStoreUrl: config.playStoreUrl,
    playStoreLive: config.playStoreLive,
    analytics: analyticsSnippet(),
    icons,
    esc: escapeHtml,
    ui: bundle.ui,
  };
}

// ------------- HOME: the landing, one template for the five languages -------------
function renderHome(cssHref) {
  const route = '/';
  for (const locale of config.locales) {
    const bundle = i18n[locale];
    const home = bundle.pages.home;
    const m = moneyOf(locale);
    // Prices as written on the page (pages.home.prices), so the structured data cannot drift from it.
    const price = (text) => {
      const digits = text.replace(/[^\d.,]/g, '');
      const normal = m.decimal === ',' ? digits.replace(/\./g, '').replace(',', '.') : digits.replace(/,/g, '');
      return Number(normal).toFixed(2);
    };

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'HomePot',
      operatingSystem: config.playStoreLive ? 'iOS, Android' : 'iOS',
      applicationCategory: 'FinanceApplication',
      description: home.description,
      url: absoluteUrl(locale, route),
      inLanguage: locale,
      installUrl: config.appStoreUrl,
      offers: [
        { '@type': 'Offer', name: home.prices.free, price: '0', priceCurrency: m.currency },
        { '@type': 'Offer', name: `HomePot Pro · ${home.prices.month}`, price: price(home.prices.pro_price_month), priceCurrency: m.currency },
        { '@type': 'Offer', name: `HomePot Pro · ${home.prices.year}`, price: price(home.prices.pro_price_year), priceCurrency: m.currency },
      ],
      publisher: { '@type': 'Organization', name: 'HomePot', email: config.contactEmail },
    };

    const ctx = pageCtx(locale, route, { title: home.title, description: home.description, jsonLd, cssHref });
    const html = render('home', {
      ...ctx,
      page: { home },
      money: { prefix: m.prefix, suffix: m.suffix },
      sim: statementDefaults(locale),
      homeJson: inlineJson({
        numberLocale: m.numberLocale,
        currency: m.currency,
        decimal: m.decimal,
        qr: { qr: ctx.appStoreQr('qr-hero'), qr2: ctx.appStoreQr('qr-sheet'), qr3: ctx.appStoreQr('qr-close') },
        t: {
          today: home.chart.today,
          lasts: home.chart.lasts,
          noteShort: home.sim.note_short,
          noteAll: home.sim.note_all,
          noteUntil: home.sim.note_until,
          spare: home.sim.spare,
          moreEach: home.sim.more_each,
          priceYear: home.prices.pro_price_year,
          perYear: home.prices.pro_per_year,
          priceMonth: home.prices.pro_price_month,
          perMonth: home.prices.pro_per_month,
        },
      }),
    });
    writeFile(outPath(locale, route), html);
    registerRoute(route, locale);
    console.log(`✓ home (${locale})`);
  }
}

// Links back to the hubs, at the end of a content page.
function backLinks(locale, keys) {
  const prefix = localePrefix(locale);
  const links = i18n[locale].ui.links;
  const all = {
    compare: { href: `${prefix}/compare/`, label: links.all_comparisons },
    guides: { href: `${prefix}/guides/`, label: links.all_guides },
    resources: { href: `${prefix}/resources/`, label: links.resources },
  };
  return keys.map((key) => all[key]);
}

// ------------- HUBS: a ruled list of links -------------
// A hub with nothing published is not built (no "coming soon" pages).
function renderHub({ route, hubKey, items, label, back }) {
  if (!items.length) return false;
  for (const locale of config.locales) {
    const bundle = i18n[locale];
    const hub = bundle.ui[hubKey];
    if (!hub) {
      console.warn(`  skipped ${route} (${locale}): missing ui.${hubKey}`);
      continue;
    }
    const localizedItems = items.map((fn) => fn(locale, bundle));

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: hub.title,
      description: hub.description,
      url: absoluteUrl(locale, route),
      inLanguage: locale,
      hasPart: localizedItems.map((it) => ({
        '@type': 'Article',
        headline: it.title,
        url: `${config.baseUrl}${it.href}`,
      })),
    };

    const ctx = pageCtx(locale, route, { title: hub.title, description: hub.description, jsonLd, cssHref: siteCss });
    const html = renderWithLayout('hub', { ...ctx, hub, items: localizedItems, back: backLinks(locale, back) });
    writeFile(outPath(locale, route), html);
    registerRoute(route, locale);
    console.log(`✓ ${label} (${locale})`);
  }
  return true;
}

const publishedComparisons = comparisons.filter((e) => e.published);
const publishedGuides = guides.filter((e) => e.published);

function renderCompareHub() {
  return renderHub({
    route: '/compare/',
    hubKey: 'compareHub',
    label: 'compare hub',
    back: ['resources'],
    items: publishedComparisons.map((entry) => (locale, bundle) => {
      const comparisonBundle = bundle.pages.comparisons[entry.i18nKey];
      return {
        href: `${localePrefix(locale)}/compare/${entry.slug}/`,
        title: comparisonBundle?.h1 || entry.competitor,
        excerpt: comparisonBundle?.description || '',
      };
    }),
  });
}

function renderGuidesHub() {
  return renderHub({
    route: '/guides/',
    hubKey: 'guidesHub',
    label: 'guides hub',
    back: ['resources'],
    items: publishedGuides.map((entry) => (locale, bundle) => {
      const guideBundle = bundle.pages.guides?.[entry.i18nKey];
      return {
        href: `${localePrefix(locale)}/guides/${entry.slug}/`,
        title: guideBundle?.h1 || entry.slug,
        excerpt: guideBundle?.description || '',
      };
    }),
  });
}

function renderResourcesHub() {
  // Links only to the category hubs that have something published
  const items = [];
  if (publishedComparisons.length) {
    items.push((locale, bundle) => ({
      href: `${localePrefix(locale)}/compare/`,
      title: bundle.ui.compareHub.h1,
      excerpt: bundle.ui.compareHub.description,
      cta: bundle.ui.links.all_comparisons,
    }));
  }
  if (publishedGuides.length) {
    items.push((locale, bundle) => ({
      href: `${localePrefix(locale)}/guides/`,
      title: bundle.ui.guidesHub.h1,
      excerpt: bundle.ui.guidesHub.description,
      cta: bundle.ui.links.all_guides,
    }));
  }
  return renderHub({ route: '/resources/', hubKey: 'resourcesHub', label: 'resources hub', back: [], items });
}

// ------------- COMPARISONS -------------
function renderComparisons() {
  for (const entry of publishedComparisons) {
    const route = `/compare/${entry.slug}/`;
    for (const locale of config.locales) {
      const bundle = i18n[locale];
      const comparisonBundle = bundle.pages.comparisons[entry.i18nKey];
      if (!comparisonBundle) {
        console.warn(`  skipped ${entry.slug} (${locale}): missing i18n key ${entry.i18nKey}`);
        continue;
      }

      // Merge shared UI with page-specific content
      const mergedComparison = {
        ...bundle.ui.comparison,
        ...comparisonBundle,
      };

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: comparisonBundle.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      };

      const ctx = pageCtx(locale, route, { title: comparisonBundle.title, description: comparisonBundle.description, ogType: 'article', jsonLd, cssHref: siteCss });
      const html = renderWithLayout('comparison', { ...ctx, entry, page: { comparison: mergedComparison }, back: backLinks(locale, ['compare', 'resources']) });
      writeFile(outPath(locale, route), html);
      registerRoute(route, locale);
      console.log(`✓ ${entry.slug} (${locale})`);
    }
  }
}

// ------------- FROM SPLITWISE -------------
function renderFromSplitwise() {
  const route = '/from-splitwise/';
  for (const locale of config.locales) {
    const bundle = i18n[locale];
    const landingBundle = bundle.pages.fromSplitwise;
    if (!landingBundle) continue;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: landingBundle.title,
      description: landingBundle.description,
      url: absoluteUrl(locale, route),
      inLanguage: locale,
    };

    const ctx = pageCtx(locale, route, { title: landingBundle.title, description: landingBundle.description, jsonLd, cssHref: siteCss });
    const html = renderWithLayout('landing', { ...ctx, page: { landing: landingBundle } });
    writeFile(outPath(locale, route), html);
    registerRoute(route, locale);
    console.log(`✓ from-splitwise (${locale})`);
  }
}

// ------------- TOOLS (calculators) -------------
// None is published. src/templates/calculator.eta and src/js/calculators/ still carry the old
// markup (Tailwind classes); they must be redrawn in the new identity before one goes live.
function renderTools() {
  for (const entry of tools) {
    if (entry.published) console.warn(`  skipped tool ${entry.slug}: calculator.eta is not ported to the new identity yet`);
  }
}

// ------------- GUIDES -------------
function renderGuides() {
  for (const entry of publishedGuides) {
    const route = `/guides/${entry.slug}/`;
    for (const locale of config.locales) {
      const bundle = i18n[locale];
      const guideBundle = bundle.pages.guides?.[entry.i18nKey];
      if (!guideBundle) {
        console.warn(`  skipped ${entry.slug} (${locale}): missing guides.${entry.i18nKey}`);
        continue;
      }

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: guideBundle.h1,
        description: guideBundle.description,
        url: absoluteUrl(locale, route),
        inLanguage: locale,
        author: { '@type': 'Organization', name: 'HomePot' },
        publisher: { '@type': 'Organization', name: 'HomePot' },
      };

      const ctx = pageCtx(locale, route, { title: guideBundle.title, description: guideBundle.description, ogType: 'article', jsonLd, cssHref: siteCss });
      // The guide's own closing words head the download slip.
      const slip = guideBundle.upsell ? { title: guideBundle.upsell.title, text: guideBundle.upsell.desc, slot: `guide-${entry.i18nKey.toLowerCase()}` } : ctx.slip;
      const html = renderWithLayout('guide', { ...ctx, entry, slip, page: { guide: guideBundle }, back: backLinks(locale, ['guides', 'resources']) });
      writeFile(outPath(locale, route), html);
      registerRoute(route, locale);
      console.log(`✓ ${entry.slug} (${locale})`);
    }
  }
}

// ------------- DELETE ACCOUNT (Google Play "account deletion URL") -------------
// One page per language, in the new identity. noindex and therefore not in the sitemap.
function renderDeleteAccount() {
  const route = '/delete-account/';
  const alternatesAbs = buildAlternatesAbs(route);

  for (const locale of config.locales) {
    const bundle = i18n[locale];
    const pageBundle = bundle.pages.deleteAccount;
    if (!pageBundle) {
      console.warn(`  skipped delete-account (${locale}): missing pages.deleteAccount`);
      continue;
    }

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: pageBundle.h1,
      description: pageBundle.description,
      url: absoluteUrl(locale, route),
      inLanguage: locale,
      publisher: { '@type': 'Organization', name: 'HomePot', email: config.contactEmail },
    };

    const ctx = {
      locale,
      defaultLocale: config.defaultLocale,
      runtime: false,
      robots: 'noindex',
      pageTitle: pageBundle.title,
      description: pageBundle.description,
      canonicalUrl: absoluteUrl(locale, route),
      alternatesAbs,
      jsonLd,
      jsonLdJson: inlineJson(jsonLd),
      cssHref: siteCss,
      langs: LANG_ORDER.map((code) => ({ code, name: LANG_NAMES[code], href: `${localePrefix(code)}${route}` })),
      homeHref: localePrefix(locale) + '/',
      deleteHref: `${localePrefix(locale)}${route}`,
      brand: { language: bundle.ui.nav.language, ...bundle.ui.brand },
      contactEmail: config.contactEmail,
      developerName: config.developerName,
      analytics: analyticsSnippet(),
      esc: escapeHtml,
      page: { deleteAccount: pageBundle },
    };

    const body = render('delete-account', ctx);
    writeFile(outPath(locale, route), render('_utility-layout', { ...ctx, body }));
    console.log(`✓ delete-account (${locale})`);
  }
}

// ------------- UTILITY PAGES (one URL, language picked in the browser) -------------
// Not registered in `routes` → never in the sitemap. Always noindex.
function utilityStrings(pick) {
  const strings = {};
  for (const locale of config.locales) {
    const bundle = i18n[locale];
    const nav = bundle.pages.home.nav;
    strings[locale] = {
      'common.language': bundle.ui.nav.language,
      ...flatten('common', bundle.ui.brand),
      'common.nav_label': nav.label,
      'common.nav_how': nav.how,
      'common.nav_pricing': nav.pricing,
      'common.nav_compare': nav.compare,
      ...pick(bundle, locale),
    };
  }
  return strings;
}

function renderUtility(template, { outFile, robots, referrer, titleKey, strings, nav = false, headInline, headScripts, bodyScripts, analytics = true, extra }) {
  const locale = config.defaultLocale; // server-rendered fallback (no JS)
  const ctx = {
    locale,
    defaultLocale: config.defaultLocale,
    runtime: true,
    baseUrl: config.baseUrl,
    appStore: appStoreHref,
    playStoreUrl: config.playStoreUrl,
    playStoreLive: config.playStoreLive,
    appScheme: config.appScheme,
    contactEmail: config.contactEmail,
    robots,
    referrer,
    titleKey,
    cssHref: siteCss,
    nav: nav ? i18n[locale].pages.home.nav : null,
    headInline,
    headScripts,
    bodyScripts,
    langs: LANG_ORDER.map((code) => ({ code, name: LANG_NAMES[code] })),
    homeHref: '/',
    deleteHref: '/delete-account/',
    brand: { language: i18n[locale].ui.nav.language, ...i18n[locale].ui.brand },
    icons,
    analytics: analytics ? analyticsSnippet() : '',
    s: strings[locale],
    esc: escapeHtml,
    i18nJson: inlineJson({ defaultLocale: locale, strings }),
    ...extra,
  };
  const body = render(template, ctx);
  writeFile(join(ROOT, outFile), render('_utility-layout', { ...ctx, body }));
  console.log(`✓ ${outFile} (runtime language: ${config.locales.join('/')})`);
}

// GitHub Pages serves /404.html for every unknown path. It also forwards the legacy
// invite links /join/CODE to /join/?c=CODE (src/js/not-found.js).
function renderNotFound() {
  renderUtility('not-found', {
    outFile: '404.html',
    robots: 'noindex',
    titleKey: 'nf.title',
    strings: utilityStrings((b) => flatten('nf', b.pages.notFound)),
    headScripts: ['/src/js/not-found.js'],
    bodyScripts: [],
  });
}

// The invite link the app shares: https://homepotapp.com/join/?c=CODE. A real page, so it
// answers 200 and WhatsApp / iMessage can show a preview card. The card's tags are static
// (crawlers do not run scripts) and the page is one URL for every language, so they are
// written in Spanish + English; the page itself is shown in the visitor's language.
// No canonical / og:url on purpose: some crawlers would follow it and drop the ?c= code.
function renderJoin() {
  const es = i18n.es.pages.join;
  const en = i18n.en.pages.join;
  renderUtility('join', {
    outFile: 'join/index.html',
    robots: 'noindex',
    titleKey: 'join.title',
    // card_* strings only feed the static preview tags below
    strings: utilityStrings((b) => Object.fromEntries(Object.entries(flatten('join', b.pages.join)).filter(([key]) => !key.startsWith('join.card_')))),
    headInline: `window.__HP_JOIN = ${inlineJson({ inviteBase: `${config.baseUrl}/join/?c=` })};`,
    headScripts: ['/src/js/join.js'],
    bodyScripts: [],
    extra: {
      description: `${es.card_description} ${en.card_description}`,
      og: {
        title: `${es.card_title} · ${en.card_title}`,
        description: `${es.card_description} ${en.card_description}`,
        image: `${config.baseUrl}/og-join.png?v=${OG_IMAGE_VERSION}`,
        imageAlt: `HomePot. ${es.card_title}. ${en.card_title}.`,
        locales: [i18n.es.meta.ogLocale, i18n.en.meta.ogLocale],
      },
    },
  });
}

// The app always links to exactly https://homepotapp.com/reset-password/
// No analytics beacon here, whatever the config says: recovery tokens travel in this
// page's URL and must not reach a third party.
function renderResetPassword() {
  renderUtility('reset-password', {
    outFile: 'reset-password/index.html',
    robots: 'noindex, nofollow',
    referrer: 'no-referrer', // recovery tokens travel in the URL
    titleKey: 'rp.title',
    strings: utilityStrings((b) => flatten('rp', b.pages.resetPassword)),
    headScripts: [],
    bodyScripts: [config.supabase.jsUrl, '/src/js/reset-password.js'],
    analytics: false,
    extra: { supabaseJson: inlineJson({ url: config.supabase.url, anonKey: config.supabase.anonKey }) },
  });
}

// ------------- SUPPORT, PRIVACY, TERMS -------------
// One URL each (the app links to them), language picked in the browser like the utility pages.
// Their text is src/i18n/pages-translations.json, untouched; only the page around it is new.
const singlePages = [
  { name: 'support', description: 'Get help with HomePot. FAQs, troubleshooting, and contact information.' },
  { name: 'privacy', description: 'HomePot Privacy Policy. Learn how we protect your data.' },
  { name: 'terms', description: 'HomePot Terms of Service. Read our terms and conditions.' },
];
function renderLegalPages() {
  for (const page of singlePages) {
    const keys = Object.keys(legal[config.defaultLocale]);
    renderUtility(page.name, {
      outFile: `${page.name}/index.html`,
      robots: 'index, follow',
      titleKey: `${page.name}.doc_title`,
      nav: true,
      strings: utilityStrings((bundle, locale) => {
        const own = Object.fromEntries(Object.entries(legal[locale]).filter(([key]) => key.startsWith(`${page.name}.`)));
        return { ...own, [`${page.name}.doc_title`]: `${own[`${page.name}.title`]} · HomePot` };
      }),
      headScripts: [],
      bodyScripts: [],
      extra: {
        description: page.description,
        canonicalUrl: `${config.baseUrl}/${page.name}/`,
        sections: keys.filter((key) => new RegExp(`^${page.name}\\.s\\d+_title$`).test(key)).length,
      },
    });
  }
}

// ------------- DEEP LINKS (.well-known) + .nojekyll -------------
function renderWellKnown() {
  const { iosAppId, androidPackage, androidSha256, paths } = config.appLinks;

  // Modern format (appIDs + components, iOS 13+) plus legacy appID + paths (iOS 12-)
  const aasa = {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [iosAppId],
          components: paths.map(({ path, comment }) => ({ '/': path, comment })),
          appID: iosAppId,
          paths: paths.map(({ path }) => path),
        },
      ],
    },
  };
  // Served without extension; GitHub Pages sends it as application/octet-stream,
  // which Apple's CDN accepts.
  writeFile(join(ROOT, '.well-known', 'apple-app-site-association'), JSON.stringify(aasa, null, 2) + '\n');
  console.log('✓ .well-known/apple-app-site-association');

  const assetlinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: androidPackage,
        sha256_cert_fingerprints: androidSha256,
      },
    },
  ];
  writeFile(join(ROOT, '.well-known', 'assetlinks.json'), JSON.stringify(assetlinks, null, 2) + '\n');
  console.log('✓ .well-known/assetlinks.json');
  if (androidSha256.some((fp) => fp.startsWith('REPLACE_WITH'))) {
    console.warn('  warning: assetlinks.json still has the placeholder SHA-256 (build.config.js → appLinks.androidSha256)');
  }

  // Without .nojekyll, GitHub Pages runs Jekyll, which drops dot-directories like .well-known
  writeFile(join(ROOT, '.nojekyll'), '');
  console.log('✓ .nojekyll');
}

// ------------- SITEMAP -------------
// One <url> entry per language version (not only the default locale), each listing the
// full set of hreflang alternates, as Google asks for localized pages. Only pages that
// call registerRoute() get here: /join/, /reset-password/, /delete-account/ and 404 do not.
// The three single-URL pages (support, privacy, terms) are added at the end.
function renderSitemap() {
  // Group routes by path so each URL entry has all hreflang alternates
  const byRoute = new Map();
  for (const r of routes) {
    if (!byRoute.has(r.route)) byRoute.set(r.route, {});
    byRoute.get(r.route)[r.locale] = r.canonical;
  }

  const today = new Date().toISOString().split('T')[0];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];

  let count = 0;
  for (const [route, locales] of byRoute.entries()) {
    const alternates = Object.entries(locales).map(
      ([lang, url]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${url}"/>`
    );
    const defaultUrl = locales[config.defaultLocale];
    if (defaultUrl) alternates.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${defaultUrl}"/>`);

    for (const [lang, url] of Object.entries(locales)) {
      const isDefault = lang === config.defaultLocale;
      xml.push('  <url>');
      xml.push(`    <loc>${url}</loc>`);
      xml.push(`    <lastmod>${today}</lastmod>`);
      xml.push('    <changefreq>weekly</changefreq>');
      xml.push(`    <priority>${route === '/' ? (isDefault ? '1.0' : '0.9') : '0.8'}</priority>`);
      xml.push(...alternates);
      xml.push('  </url>');
      count++;
    }
  }

  // Support, privacy and terms: one URL each, the language is chosen in the browser
  for (const page of singlePages) {
    xml.push('  <url>');
    xml.push(`    <loc>${config.baseUrl}/${page.name}/</loc>`);
    xml.push(`    <lastmod>${today}</lastmod>`);
    xml.push('    <changefreq>monthly</changefreq>');
    xml.push('    <priority>0.5</priority>');
    xml.push('  </url>');
    count++;
  }

  xml.push('</urlset>');
  writeFile(join(ROOT, 'sitemap.xml'), xml.join('\n') + '\n');
  console.log(`✓ sitemap.xml (${count} URLs: ${byRoute.size} routes × language versions)`);
}

// ------------- ROBOTS -------------
function renderRobots() {
  const content = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${config.baseUrl}/sitemap.xml`,
    '',
  ].join('\n');
  writeFile(join(ROOT, 'robots.txt'), content);
  console.log('✓ robots.txt');
}

// ------------- MAIN -------------
console.log('Building homepotapp.com...\n');
const siteCss = buildCss('site');
const homeCss = buildCss('home');
renderHome(homeCss);
renderResourcesHub();
renderCompareHub();
renderGuidesHub();
renderComparisons();
renderFromSplitwise();
renderTools();
renderGuides();
renderDeleteAccount();
renderNotFound();
renderJoin();
renderResetPassword();
renderLegalPages();
renderWellKnown();
renderSitemap();
renderRobots();
if (!analyticsSnippet()) console.log('  analytics: off (build.config.js → analytics.cloudflareToken is empty)');
if (!String(config.appStore?.providerToken || '').trim()) console.log('  App Store campaign links: off (build.config.js → appStore.providerToken is empty)');
console.log(`\nDone. ${routes.length} pages generated.`);
