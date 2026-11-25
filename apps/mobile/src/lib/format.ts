import { formatMoney, t as tr, type Currency, type Locale, type LocalizedText } from '@factory/core';

export const intlLocale = (l: string) => (l === 'de' ? 'de-DE' : 'en-GB');
export const money = (amount: number, currency: string, locale: string) => formatMoney({ amount, currency: currency as Currency }, intlLocale(locale));
export const lt = (text: LocalizedText | string | undefined | null, locale: string) => tr(text, locale as Locale);
export const pct = (bps: number, locale: string) => `${(bps / 100).toLocaleString(intlLocale(locale))} %`;
export const dateTime = (iso: string, locale: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) =>
  new Intl.DateTimeFormat(intlLocale(locale), { timeZone: 'Europe/Berlin', ...opts }).format(new Date(iso));

/** Kinds that are digital content in app-store terms (need store billing when sold in-app). */
export const DIGITAL_KINDS = new Set(['ebook', 'interactive_book', 'digital_download', 'license', 'subscription', 'course']);
