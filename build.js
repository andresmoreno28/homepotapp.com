import { Eta } from 'eta';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
      appStoreUrl: config.appStoreUrl,
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
      appStoreUrl: config.appStoreUrl,
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
        appStoreUrl: config.appStoreUrl,
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
      appStoreUrl: config.appStoreUrl,
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
        appStoreUrl: config.appStoreUrl,
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
        appStoreUrl: config.appStoreUrl,
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
function renderDeleteAccount() {
  const route = '/delete-account/';
  const alternates = buildAlternatesRel(route);
  const alternatesAbs = buildAlternatesAbs(route);

  for (const locale of config.locales) {
    const bundle = i18n[locale];
    const pageBundle = bundle.pages.deleteAccount;
    if (!pageBundle) {
      console.warn(`  skipped delete-account (${locale}): missing pages.deleteAccount`);
      continue;
    }
    const homeHref = localePrefix(locale) + '/';

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
      baseUrl: config.baseUrl,
      appStoreUrl: config.appStoreUrl,
      contactEmail: config.contactEmail,
      promoSignupUrl: config.promoSignupUrl,
      developerName: config.developerName,
      homeHref,
      alternates,
      alternatesAbs,
      pageTitle: pageBundle.title,
      pageDescription: pageBundle.description,
      canonicalUrl: absoluteUrl(locale, route),
      ogTitle: pageBundle.title,
      ogDescription: pageBundle.description,
      ogLocale: bundle.meta.ogLocale,
      ogType: 'website',
      jsonLd,
      ui: bundle.ui,
      page: { deleteAccount: pageBundle },
    };

    const html = renderWithLayout('delete-account', ctx);
    writeFile(outPath(locale, route), html);
    registerRoute(route, locale);
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
      'common.help': bundle.ui.footer.help,
      'common.privacy': bundle.ui.footer.privacy,
      'common.terms': bundle.ui.footer.terms,
      'common.delete_account': bundle.ui.footer.delete_account,
      'common.copyright': bundle.ui.footer.copyright,
      ...pick(bundle),
    };
  }
  return strings;
}

function renderUtility(template, { outFile, robots, referrer, titleKey, strings, headScripts, bodyScripts, extra }) {
  const locale = config.defaultLocale; // server-rendered fallback (no JS)
  const ctx = {
    locale,
    locales: config.locales,
    baseUrl: config.baseUrl,
    appStoreUrl: config.appStoreUrl,
    playStoreUrl: config.playStoreUrl,
    playStoreLive: config.playStoreLive,
    appScheme: config.appScheme,
    contactEmail: config.contactEmail,
    robots,
    referrer,
    titleKey,
    headScripts,
    bodyScripts,
    s: strings[locale],
    esc: escapeHtml,
    i18nJson: inlineJson({ defaultLocale: locale, strings }),
    ...extra,
  };
  const body = render(template, ctx);
  writeFile(join(ROOT, outFile), render('_utility-layout', { ...ctx, body }));
  console.log(`✓ ${outFile} (runtime language: ${config.locales.join('/')})`);
}

// GitHub Pages serves /404.html for every unknown path → also the /join/CODE fallback
function renderNotFound() {
  renderUtility('not-found', {
    outFile: '404.html',
    robots: 'noindex',
    titleKey: 'nf.title',
    strings: utilityStrings((b) => ({ ...flatten('nf', b.pages.notFound), ...flatten('join', b.pages.join) })),
    headScripts: ['/src/js/not-found.js'],
    bodyScripts: [],
  });
}

// The app always links to exactly https://homepotapp.com/reset-password/
function renderResetPassword() {
  renderUtility('reset-password', {
    outFile: 'reset-password/index.html',
    robots: 'noindex, nofollow',
    referrer: 'no-referrer', // recovery tokens travel in the URL
    titleKey: 'rp.title',
    strings: utilityStrings((b) => flatten('rp', b.pages.resetPassword)),
    headScripts: [],
    bodyScripts: [config.supabase.jsUrl, '/src/js/reset-password.js'],
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

  for (const [route, locales] of byRoute.entries()) {
    const defaultUrl = locales[config.defaultLocale];
    if (!defaultUrl) continue;
    xml.push('  <url>');
    xml.push(`    <loc>${defaultUrl}</loc>`);
    xml.push(`    <lastmod>${today}</lastmod>`);
    xml.push('    <changefreq>weekly</changefreq>');
    xml.push(`    <priority>${route === '/' ? '1.0' : '0.8'}</priority>`);
    for (const [lang, url] of Object.entries(locales)) {
      xml.push(`    <xhtml:link rel="alternate" hreflang="${lang}" href="${url}"/>`);
    }
    xml.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${locales[config.defaultLocale]}"/>`);
    xml.push('  </url>');
  }

  xml.push('</urlset>');
  writeFile(join(ROOT, 'sitemap.xml'), xml.join('\n') + '\n');
  console.log(`✓ sitemap.xml (${byRoute.size} routes × ${config.locales.length} locales)`);
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
renderDeleteAccount();
renderNotFound();
renderResetPassword();
renderWellKnown();
renderSitemap();
renderRobots();
console.log(`\nDone. ${routes.length} pages generated.`);
