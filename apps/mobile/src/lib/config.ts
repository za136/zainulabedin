import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; webUrl?: string; storeId?: string };

/** Where the commerce API and the website live (set via EXPO_PUBLIC_API_URL / EXPO_PUBLIC_WEB_URL). */
export const API_URL = (extra.apiUrl ?? 'http://localhost:4000').replace(/\/$/, '');
export const WEB_URL = (extra.webUrl ?? 'http://localhost:3000').replace(/\/$/, '');
export const STORE_ID = extra.storeId ?? 'store';

/** Localised website URL (German has no prefix). */
export function webUrl(path: string, locale: string, defaultLocale = 'de') {
  return `${WEB_URL}${locale === defaultLocale ? '' : `/${locale}`}${path}`;
}
