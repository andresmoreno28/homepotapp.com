import { Eta } from 'eta';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
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

// Relative URLs for in-page navigation (navbar language switcher)
function buildAlternatesRel(route) {
  const links = {};
  for (const loc of config.locales) {
    links[loc] = `${localePrefix(loc)}${route}`;
  }
  return links;
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

// Context every per-language page gets: store links, analytics and its preview image.
function shared(locale) {
  return {
    appStore: (slot) => appStoreHref(`web-${locale}-${slot}`),
    analytics: analyticsSnippet(),
    ogImage: ogImageUrl(locale),
  };
}

// ------------- new identity (utility pages) -------------
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
};

// src/styles/utility.css → /assets/utility.css, linked with a content hash.
function buildUtilityCss() {
  const css = readFileSync(join(SRC, 'styles', 'utility.css'), 'utf8');
  writeFile(join(ROOT, 'assets', 'utility.css'), css);
  console.log('✓ assets/utility.css');
  return `/assets/utility.css?v=${createHash('sha1').update(css).digest('hex').slice(0, 8)}`;
}

// ------------- load data -------------
const i18n = {};
for (const loc of config.locales) {
  i18n[loc] = loadJson(join(SRC, 'i18n', `${loc}.json`));
}

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

// ------------- HOME -------------
function renderHome() {
  const route = '/';
  const alternates = buildAlternatesRel(route);
  const alternatesAbs = buildAlternatesAbs(route);

  for (const locale of config.locales) {
    const bundle = i18n[locale];
    const homeHref = localePrefix(locale) + '/';

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'MobileApplication',
      name: 'HomePot',
      operatingSystem: 'iOS',
      applicationCategory: 'FinanceApplication',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      description: bundle.pages.home.description,
      url: absoluteUrl(locale, route),
      inLanguage: locale,
      publisher: { '@type': 'Organization', name: 'HomePot', email: config.contactEmail },
    };

    const ctx = {
      locale,
      baseUrl: config.baseUrl,
      ...shared(locale),
      contactEmail: config.contactEmail,
      promoSignupUrl: config.promoSignupUrl,
      homeHref,
      alternates,
      alternatesAbs,
      pageTitle: bundle.pages.home.title,
      pageDescription: bundle.pages.home.description,
      canonicalUrl: absoluteUrl(locale, route),
      ogTitle: bundle.pages.home.title,
      ogDescription: bundle.pages.home.description,
      ogLocale: bundle.meta.ogLocale,
      ogType: 'website',
      jsonLd,
      ui: bundle.ui,
      page: { home: bundle.pages.home },
    };

    const html = renderWithLayout('home', ctx);
    writeFile(outPath(locale, route), html);
    registerRoute(route, locale);
    console.log(`✓ home (${locale})`);
  }
}

// ------------- GENERIC HUB RENDERER -------------
function renderHub({ route, hubKey, items, label, placeholders, showTrust }) {
  const alternates = buildAlternatesRel(route);
  const alternatesAbs = buildAlternatesAbs(route);

  for (const locale of config.locales) {
    const bundle = i18n[locale];
    const hub = bundle.ui[hubKey];
    if (!hub) {
      console.warn(`  skipped ${route} (${locale}): missing ui.${hubKey}`);
      continue;
    }
    const homeHref = localePrefix(locale) + '/';

    const localizedItems = (items || []).map((fn) => fn(locale, bundle));
    const localizedPlaceholders = placeholders ? placeholders(bundle) : [];

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

    const ctx = {
      locale,
      baseUrl: config.baseUrl,
      ...shared(locale),
      contactEmail: config.contactEmail,
      promoSignupUrl: config.promoSignupUrl,
      homeHref,
      alternates,
      alternatesAbs,
      pageTitle: hub.title,
      pageDescription: hub.description,
      canonicalUrl: absoluteUrl(locale, route),
      ogTitle: hub.title,
      ogDescription: hub.description,
      ogLocale: bundle.meta.ogLocale,
      ogType: 'website',
      jsonLd,
      ui: bundle.ui,
      hub,
      items: localizedItems,
      placeholders: localizedPlaceholders,
    };

    const html = renderWithLayout('hub', ctx);
    writeFile(outPath(locale, route), html);
    registerRoute(route, locale);
    console.log(`✓ ${label} (${locale})`);
  }
}

function renderCompareHub() {
  renderHub({
    route: '/compare/',
    hubKey: 'compareHub',
    label: 'compare hub',
    items: comparisons
      .filter((e) => e.published)
      .map((entry) => (locale, bundle) => {
        const comparisonBundle = bundle.pages.comparisons[entry.i18nKey];
        return {
          href: `${localePrefix(locale)}/compare/${entry.slug}/`,
          title: comparisonBundle?.h1 || entry.competitor,
          excerpt: comparisonBundle?.description || '',
          icon: entry.icon || 'compare',
        };
      }),
    placeholders: (bundle) => (comparisons.filter((e) => e.published).length < 4 ? [bundle.ui.compareHub.cta + '…'] : []),
  });
}

function renderToolsHub() {
  // Skip entirely while there are no published tools
  if (!tools.some((e) => e.published)) return;
  renderHub({
    route: '/tools/',
    hubKey: 'toolsHub',
    label: 'tools hub',
    items: tools
      .filter((e) => e.published)
      .map((entry) => (locale, bundle) => {
        const toolBundle = bundle.pages.tools?.[entry.i18nKey];
        return {
          href: `${localePrefix(locale)}/tools/${entry.slug}/`,
          title: toolBundle?.h1 || entry.slug,
          excerpt: toolBundle?.description || '',
          icon: entry.icon || 'calculate',
        };
      }),
    placeholders: (bundle) => [bundle.ui.toolsHub.empty_body],
  });
}

function renderGuidesHub() {
  renderHub({
    route: '/guides/',
    hubKey: 'guidesHub',
    label: 'guides hub',
    items: guides
      .filter((e) => e.published)
      .map((entry) => (locale, bundle) => {
        const guideBundle = bundle.pages.guides?.[entry.i18nKey];
        return {
          href: `${localePrefix(locale)}/guides/${entry.slug}/`,
          title: guideBundle?.h1 || entry.slug,
          excerpt: guideBundle?.description || '',
          icon: entry.icon || 'menu_book',
        };
      }),
    placeholders: (bundle) => [bundle.ui.guidesHub.empty_body],
  });
}

function renderResourcesHub() {
  // Top-level: links only to category hubs that have at least one published entry
  const hasTools = tools.some((e) => e.published);
  const hasGuides = guides.some((e) => e.published);
  const hasComparisons = comparisons.some((e) => e.published);

  const items = [];
  if (hasComparisons) {
    items.push((locale, bundle) => ({
      href: `${localePrefix(locale)}/compare/`,
      title: bundle.ui.compareHub.h1,
      excerpt: bundle.ui.compareHub.description,
      icon: 'compare',
      badge: bundle.ui.compareHub.badge,
    }));
  }
  if (hasTools) {
    items.push((locale, bundle) => ({
      href: `${localePrefix(locale)}/tools/`,
      title: bundle.ui.toolsHub.h1,
      excerpt: bundle.ui.toolsHub.description,
      icon: 'calculate',
      badge: bundle.ui.toolsHub.badge,
    }));
  }
  if (hasGuides) {
    items.push((locale, bundle) => ({
      href: `${localePrefix(locale)}/guides/`,
      title: bundle.ui.guidesHub.h1,
      excerpt: bundle.ui.guidesHub.description,
      icon: 'menu_book',
      badge: bundle.ui.guidesHub.badge,
    }));
  }

  renderHub({
    route: '/resources/',
    hubKey: 'resourcesHub',
    label: 'resources hub',
    items,
    placeholders: () => [],
  });
}

// ------------- COMPARISONS -------------
function renderComparisons() {
  for (const entry of comparisons) {
    if (!entry.published) continue;
    const route = `/compare/${entry.slug}/`;
    const alternates = buildAlternatesRel(route);
    const alternatesAbs = buildAlternatesAbs(route);

    for (const locale of config.locales) {
      const bundle = i18n[locale];
      const comparisonBundle = bundle.pages.comparisons[entry.i18nKey];
      if (!comparisonBundle) {
        console.warn(`  skipped ${entry.slug} (${locale}): missing i18n key ${entry.i18nKey}`);
        continue;
      }
      const homeHref = localePrefix(locale) + '/';

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

      const ctx = {
        locale,
        baseUrl: config.baseUrl,
        ...shared(locale),
        contactEmail: config.contactEmail,
        promoSignupUrl: config.promoSignupUrl,
        homeHref,
        alternates,
        alternatesAbs,
        pageTitle: comparisonBundle.title,
        pageDescription: comparisonBundle.description,
        canonicalUrl: absoluteUrl(locale, route),
        ogTitle: comparisonBundle.title,
        ogDescription: comparisonBundle.description,
        ogLocale: bundle.meta.ogLocale,
        ogType: 'article',
        jsonLd,
        ui: bundle.ui,
        entry,
        page: { comparison: mergedComparison },
      };

      const html = renderWithLayout('comparison', ctx);
      writeFile(outPath(locale, route), html);
      registerRoute(route, locale);
      console.log(`✓ ${entry.slug} (${locale})`);
    }
  }
}

// ------------- FROM SPLITWISE LANDING -------------
function renderFromSplitwise() {
  const route = '/from-splitwise/';
  const alternates = buildAlternatesRel(route);
  const alternatesAbs = buildAlternatesAbs(route);

  for (const locale of config.locales) {
    const bundle = i18n[locale];
    const landingBundle = bundle.pages.fromSplitwise;
    if (!landingBundle) continue;
    const homeHref = localePrefix(locale) + '/';

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: landingBundle.title,
      description: landingBundle.description,
      url: absoluteUrl(locale, route),
      inLanguage: locale,
    };

    const ctx = {
      locale,
      baseUrl: config.baseUrl,
      ...shared(locale),
      contactEmail: config.contactEmail,
      promoSignupUrl: config.promoSignupUrl,
      homeHref,
      alternates,
      alternatesAbs,
      pageTitle: landingBundle.title,
      pageDescription: landingBundle.description,
      canonicalUrl: absoluteUrl(locale, route),
      ogTitle: landingBundle.title,
      ogDescription: landingBundle.description,
      ogLocale: bundle.meta.ogLocale,
      ogType: 'website',
      jsonLd,
      ui: bundle.ui,
      page: { landing: landingBundle },
    };

    const html = renderWithLayout('landing', ctx);
    writeFile(outPath(locale, route), html);
    registerRoute(route, locale);
    console.log(`✓ from-splitwise (${locale})`);
  }
}

// ------------- TOOLS (calculators) -------------
function renderTools() {
  for (const entry of tools) {
    if (!entry.published) continue;
    const route = `/tools/${entry.slug}/`;
    const alternates = buildAlternatesRel(route);
    const alternatesAbs = buildAlternatesAbs(route);

    for (const locale of config.locales) {
      const bundle = i18n[locale];
      const toolBundle = bundle.pages.tools?.[entry.i18nKey];
      if (!toolBundle) {
        console.warn(`  skipped ${entry.slug} (${locale}): missing tools.${entry.i18nKey}`);
        continue;
      }
      const homeHref = localePrefix(locale) + '/';

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: toolBundle.h1,
        description: toolBundle.description,
        url: absoluteUrl(locale, route),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Any (browser)',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        inLanguage: locale,
      };

      const ctx = {
        locale,
        baseUrl: config.baseUrl,
        ...shared(locale),
        contactEmail: config.contactEmail,
        promoSignupUrl: config.promoSignupUrl,
        homeHref,
        alternates,
        alternatesAbs,
        pageTitle: toolBundle.title,
        pageDescription: toolBundle.description,
        canonicalUrl: absoluteUrl(locale, route),
        ogTitle: toolBundle.title,
        ogDescription: toolBundle.description,
        ogLocale: bundle.meta.ogLocale,
        ogType: 'website',
        jsonLd,
        ui: bundle.ui,
        entry,
        page: { calculator: toolBundle },
      };

      const html = renderWithLayout('calculator', ctx);
      writeFile(outPath(locale, route), html);
      registerRoute(route, locale);
      console.log(`✓ ${entry.slug} (${locale})`);
    }
  }
}

// ------------- GUIDES -------------
function renderGuides() {
  for (const entry of guides) {
    if (!entry.published) continue;
    const route = `/guides/${entry.slug}/`;
    const alternates = buildAlternatesRel(route);
    const alternatesAbs = buildAlternatesAbs(route);

    for (const locale of config.locales) {
      const bundle = i18n[locale];
      const guideBundle = bundle.pages.guides?.[entry.i18nKey];
      if (!guideBundle) {
        console.warn(`  skipped ${entry.slug} (${locale}): missing guides.${entry.i18nKey}`);
        continue;
      }
      const homeHref = localePrefix(locale) + '/';

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

      const ctx = {
        locale,
        baseUrl: config.baseUrl,
        ...shared(locale),
        contactEmail: config.contactEmail,
        promoSignupUrl: config.promoSignupUrl,
        homeHref,
        alternates,
        alternatesAbs,
        pageTitle: guideBundle.title,
        pageDescription: guideBundle.description,
        canonicalUrl: absoluteUrl(locale, route),
        ogTitle: guideBundle.title,
        ogDescription: guideBundle.description,
        ogLocale: bundle.meta.ogLocale,
        ogType: 'article',
        jsonLd,
        ui: bundle.ui,
        entry,
        page: { guide: guideBundle },
      };

      const html = renderWithLayout('guide', ctx);
      writeFile(outPath(locale, route), html);
      registerRoute(route, locale);
      console.log(`✓ ${entry.slug} (${locale})`);
    }
  }
}

// ------------- DELETE ACCOUNT (Google Play "account deletion URL") -------------
// One page per language, in the new identity. noindex and therefore not in the sitemap.
function renderDeleteAccount(cssHref) {
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
      cssHref,
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
    strings[locale] = {
      'common.language': bundle.ui.nav.language,
      ...flatten('common', bundle.ui.brand),
      ...pick(bundle),
    };
  }
  return strings;
}

function renderUtility(template, { outFile, cssHref, robots, referrer, titleKey, strings, headInline, headScripts, bodyScripts, analytics = true, extra }) {
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
    cssHref,
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
function renderNotFound(cssHref) {
  renderUtility('not-found', {
    outFile: '404.html',
    cssHref,
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
function renderJoin(cssHref) {
  const es = i18n.es.pages.join;
  const en = i18n.en.pages.join;
  renderUtility('join', {
    outFile: 'join/index.html',
    cssHref,
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
function renderResetPassword(cssHref) {
  renderUtility('reset-password', {
    outFile: 'reset-password/index.html',
    cssHref,
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

  xml.push('</urlset>');
  writeFile(join(ROOT, 'sitemap.xml'), xml.join('\n') + '\n');
  console.log(`✓ sitemap.xml (${count} URLs: ${byRoute.size} routes × language versions)`);
}

// ------------- ANALYTICS ON HAND-WRITTEN PAGES -------------
// /privacy/, /terms/ and /support/ are not generated. They carry a pair of marker comments
// before </body>; the beacon (or nothing, while the token is empty) is written between them.
const STATIC_PAGES = ['privacy/index.html', 'terms/index.html', 'support/index.html'];
function injectStaticAnalytics() {
  const snippet = analyticsSnippet();
  const marker = /(<!-- analytics:start[^>]*-->)[\s\S]*?(<!-- analytics:end -->)/;
  for (const rel of STATIC_PAGES) {
    const file = join(ROOT, rel);
    if (!existsSync(file)) continue;
    const html = readFileSync(file, 'utf8');
    if (!marker.test(html)) {
      console.warn(`  warning: ${rel} has no analytics markers, the beacon cannot be added there`);
      continue;
    }
    const next = html.replace(marker, (_, open, close) => `${open}${snippet ? `\n${snippet}\n` : ''}${close}`);
    if (next !== html) writeFileSync(file, next, 'utf8');
    console.log(`✓ ${rel} (analytics ${snippet ? 'on' : 'off'})`);
  }
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
renderHome();
renderResourcesHub();
renderCompareHub();
renderToolsHub();
renderGuidesHub();
renderComparisons();
renderFromSplitwise();
renderTools();
renderGuides();
const utilityCss = buildUtilityCss();
renderDeleteAccount(utilityCss);
renderNotFound(utilityCss);
renderJoin(utilityCss);
renderResetPassword(utilityCss);
renderWellKnown();
renderSitemap();
renderRobots();
injectStaticAnalytics();
if (!analyticsSnippet()) console.log('  analytics: off (build.config.js → analytics.cloudflareToken is empty)');
if (!String(config.appStore?.providerToken || '').trim()) console.log('  App Store campaign links: off (build.config.js → appStore.providerToken is empty)');
console.log(`\nDone. ${routes.length} pages generated.`);
