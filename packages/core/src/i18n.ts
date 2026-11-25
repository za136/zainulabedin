import { z } from 'zod';

/** Locales the factory knows about. German is first-class; add more freely. */
export const LOCALES = ['de', 'en', 'fr', 'it'] as const;
export type Locale = (typeof LOCALES)[number];
export const localeSchema = z.enum(LOCALES);

/** A string translated into several locales: `{ de: 'Buch', en: 'Book' }`. */
export type LocalizedText = Partial<Record<Locale, string>>;
export const localizedTextSchema = z.partialRecord(localeSchema, z.string());

/**
 * Resolve a localized value with a fallback chain (requested → fallbacks → any).
 * German-first stores pass `['de']` as fallbacks so missing English text shows German.
 */
export function t(text: LocalizedText | string | undefined | null, locale: Locale, fallbacks: readonly Locale[] = ['de', 'en']): string {
  if (text == null) return '';
  if (typeof text === 'string') return text;
  if (text[locale]) return text[locale]!;
  for (const fb of fallbacks) if (text[fb]) return text[fb]!;
  const first = Object.values(text).find(Boolean);
  return first ?? '';
}

/** Negotiate a supported locale from an Accept-Language header. */
export function negotiateLocale(header: string | undefined, supported: readonly Locale[], fallback: Locale): Locale {
  if (!header) return fallback;
  const prefs = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return { tag: (tag ?? '').toLowerCase(), q: q ? Number(q.trim().slice(2)) : 1 };
    })
    .filter((p) => p.tag)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of prefs) {
    const base = tag.split('-')[0] as Locale;
    if (supported.includes(base)) return base;
  }
  return fallback;
}
