export default {
  baseUrl: 'https://homepotapp.com',
  locales: ['en', 'es', 'fr', 'de', 'pt'],
  defaultLocale: 'en',
  appStoreUrl: 'https://apps.apple.com/app/homepot-shared-expenses/id6759216594',
  contactEmail: 'homepotapp@gmail.com',
  promoSignupUrl: 'https://haggaeeajlbmktsinbek.supabase.co/functions/v1/promo-signup',

  // Shown on /delete-account/ (Google Play requires the app or developer name).
  developerName: 'HomePot App',

  // Android listing. While playStoreLive is false the join page shows Google Play
  // as "coming soon" (no link).
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.homepot.app',
  playStoreLive: false,

  // Custom URL scheme of the app (used by /join/ fallback and /reset-password/).
  appScheme: 'homepot://',

  // Universal Links (iOS) + App Links (Android) → .well-known/ files.
  appLinks: {
    iosAppId: 'F69JJSZC9V.com.homepot.app',
    androidPackage: 'com.homepot.app',
    // Replace with the SHA-256 of the Play App Signing key
    // (Play Console > Test and release > App integrity > App signing).
    androidSha256: ['REPLACE_WITH_PLAY_APP_SIGNING_SHA256'],
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
