import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { createClient, type StorePublic } from '@factory/sdk';

/**
 * Server-side API access (BFF pattern). The browser never talks to the API with a
 * session token: tokens live in an httpOnly cookie on the storefront domain and
 * are forwarded as Bearer tokens from Server Components and Server Actions.
 */
export const SESSION_COOKIE = 'sf_session';
export const CART_COOKIE = 'sf_cart';
export const COUNTRY_COOKIE = 'sf_country';

export const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export async function api() {
  const jar = await cookies();
  const locale = (await getLocale()) as 'de' | 'en';
  return createClient({
    baseUrl: API_URL,
    token: jar.get(SESSION_COOKIE)?.value,
    market: { locale, country: jar.get(COUNTRY_COOKIE)?.value },
    init: { cache: 'no-store' },
  });
}

/** Store config, memoised per request. */
export const getStore = cache(async (): Promise<StorePublic> => (await api()).store());

export async function getSessionUser() {
  const jar = await cookies();
  if (!jar.get(SESSION_COOKIE)) return null;
  try {
    return (await (await api()).me.get()).customer;
  } catch {
    return null;
  }
}

export async function getCartSafe() {
  const jar = await cookies();
  const id = jar.get(CART_COOKIE)?.value;
  if (!id) return null;
  try {
    const cart = await (await api()).cart.get(id);
    return cart.status === 'open' ? cart : null;
  } catch {
    return null;
  }
}
