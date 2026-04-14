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
renderComparisons();
renderSitemap();
renderRobots();
console.log(`\nDone. ${routes.length} pages generated.`);
