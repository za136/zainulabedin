import { defineRouting } from 'next-intl/routing';

/**
 * German first: German lives at "/", English at "/en". Add locales here and in
 * store.json → locales.supported (and a messages/<locale>.json file).
 */
export const routing = defineRouting({
  locales: ['de', 'en'],
  defaultLocale: 'de',
  localePrefix: 'as-needed',
  localeDetection: false, // German-first: do not auto-redirect based on browser language
});
export type AppLocale = (typeof routing.locales)[number];
