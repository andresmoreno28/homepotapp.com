export default {
  baseUrl: 'https://homepotapp.com',
  locales: ['en', 'es', 'fr', 'de', 'pt'],
  defaultLocale: 'en',
  appStoreUrl: 'https://apps.apple.com/app/homepot-shared-expenses/id6759216594',
  contactEmail: 'homepotapp@gmail.com',

  // Measurement hooks. Both are OFF while their token is empty: nothing is added to any page.
  //
  // analytics.cloudflareToken — Cloudflare Web Analytics (cookieless, no consent banner needed).
  //   Create the site at dash.cloudflare.com > Analytics & Logs > Web Analytics and paste the
  //   token of its JS snippet here (32 hex characters). Every page then loads Cloudflare's
  //   beacon, except /reset-password/, which is left out on purpose because password recovery
  //   tokens travel in its URL.
  //
  // appStore.providerToken — the numeric "pt" of your App Store Connect campaign links
  //   (App Analytics > Acquisition > Campaigns > Generate Campaign Link, the number after pt=).
  //   Every App Store link on the site is built by one helper (appStoreLink in build.js) and
  //   then becomes <appStoreUrl>?pt=<providerToken>&ct=<placement>&mt=8, with one "ct" per
  //   button so App Store Connect shows where each download came from:
  //     home:     web-<lang>-hero | sheet | pricing-free | pricing-pro | close   (e.g. web-es-hero)
  //               web-<lang>-qr-hero | qr-sheet | qr-close           (its three QR codes)
  //     content:  web-<lang>-vs-splitwise | vs-tricount | from-splitwise | guide-roommates
  //               web-<lang>-cta                                     (the slip that closes a page)
  //     invite:   web-join
  analytics: { cloudflareToken: '' },
  appStore: { providerToken: '' },

  // Shown on /delete-account/ (Google Play requires the app or developer name).
  developerName: 'HomePot App',

  // Android listing. While playStoreLive is false the join page shows Google Play
  // as "coming soon" (no link).
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.homepot.app',
  playStoreLive: false,

  // Custom URL scheme of the app (used by /join/ and /reset-password/).
  appScheme: 'homepot://',

  // Universal Links (iOS) + App Links (Android) → .well-known/ files.
  appLinks: {
    iosAppId: 'F69JJSZC9V.com.homepot.app',
    androidPackage: 'com.homepot.app',
    // Replace with the SHA-256 of the Play App Signing key
    // (Play Console > Test and release > App integrity > App signing).
    androidSha256: ['REPLACE_WITH_PLAY_APP_SIGNING_SHA256'],
    // '/join/*' covers both the current link (/join/?c=CODE: the path is /join/, the query
    // string is not part of the match) and the legacy one (/join/CODE).
    paths: [{ path: '/join/*', comment: 'Group invite links' }],
  },

  // Public Supabase client config for /reset-password/. The anon key is public by
  // design (it ships inside the app too); Row Level Security protects the data.
  supabase: {
    url: 'https://haggaeeajlbmktsinbek.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZ2dhZWVhamxibWt0c2luYmVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyODU1MTQsImV4cCI6MjA4NDg2MTUxNH0.Tolm7Vco3AHp1MRMdoniNXn1xckKB2YICT-eOpOUL_k',
    jsUrl: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js',
  },
};
