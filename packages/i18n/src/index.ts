import de from './de.json';
import en from './en.json';

/**
 * ICU message catalogues (next-intl / use-intl format). German is the source of truth;
 * every key must exist in every locale (enforced by test/i18n.test.ts).
 * Add a locale: create <locale>.json, register it here, add it to the web routing
 * and to store.json → locales.supported.
 */
export const messages = { de, en } as const;
export type Messages = typeof de;
export type MessageLocale = keyof typeof messages;
export const MESSAGE_LOCALES = Object.keys(messages) as MessageLocale[];
