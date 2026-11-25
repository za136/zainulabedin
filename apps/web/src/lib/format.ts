import { formatMoney, t as tr, type Currency, type Locale, type LocalizedText } from '@factory/core';

export const intlLocale = (l: string) => (l === 'de' ? 'de-DE' : l === 'en' ? 'en-GB' : l);

export function money(amount: number, currency: string, locale: string) {
  return formatMoney({ amount, currency: currency as Currency }, intlLocale(locale));
}

export function lt(text: LocalizedText | string | undefined | null, locale: string) {
  return tr(text, locale as Locale);
}

export function pct(bps: number, locale: string) {
  return `${(bps / 100).toLocaleString(intlLocale(locale))} %`;
}

export function dateTime(iso: string, locale: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'full', timeStyle: 'short' }) {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: 'Europe/Berlin', ...opts }).format(new Date(iso));
}

/** Deterministic hash → used for generative product art. */
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Canonical legal keys ↔ localized URL slugs */
export const LEGAL_SLUGS: Record<string, { de: string; en: string }> = {
  imprint: { de: 'impressum', en: 'imprint' },
  terms: { de: 'agb', en: 'terms' },
  withdrawal: { de: 'widerruf', en: 'withdrawal' },
  privacy: { de: 'datenschutz', en: 'privacy' },
  shipping: { de: 'versand-zahlung', en: 'shipping-payment' },
};
export function legalKey(slug: string) {
  return Object.entries(LEGAL_SLUGS).find(([k, v]) => k === slug || v.de === slug || v.en === slug)?.[0] ?? slug;
}
export function legalHref(key: string, locale: string) {
  return `/legal/${LEGAL_SLUGS[key]?.[locale as 'de'] ?? key}`;
}
