'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { ApiError, type Cart, type CheckoutInput, type CheckoutResult } from '@factory/sdk';
import { api, CART_COOKIE, COUNTRY_COOKIE, SESSION_COOKIE } from './api';

/**
 * SERVER ACTIONS — the storefront's only write path. Each returns a discriminated
 * result instead of throwing so client components can show translated errors.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string; details?: unknown };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, code: e.code, message: e.message, details: e.details };
    console.error(e);
    return { ok: false, code: 'network_error', message: 'Service unavailable' };
  }
}

const cookieOpts = (days: number) => ({ httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: days * 86400 });

async function ensureCart(): Promise<string> {
  const jar = await cookies();
  const client = await api();
  const existing = jar.get(CART_COOKIE)?.value;
  if (existing) {
    try {
      const c = await client.cart.get(existing);
      if (c.status === 'open') return c.id;
    } catch {
      /* create a new one */
    }
  }
  const cart = await client.cart.create({ locale: (await getLocale()) as 'de', country: jar.get(COUNTRY_COOKIE)?.value });
  jar.set(CART_COOKIE, cart.id, cookieOpts(30));
  return cart.id;
}

export async function addToCart(variantId: string, quantity = 1, slotId?: string): Promise<ActionResult<Cart>> {
  return run(async () => {
    const id = await ensureCart();
    const cart = await (await api()).cart.addItem(id, { variantId, quantity, slotId });
    revalidatePath('/', 'layout');
    return cart;
  });
}

export async function setQuantity(itemId: string, quantity: number) {
  return run(async () => (await api()).cart.setQuantity(await ensureCart(), itemId, quantity));
}

export async function updateCart(patch: { couponCode?: string | null; shippingRateId?: string | null; country?: string }) {
  return run(async () => {
    const cart = await (await api()).cart.update(await ensureCart(), patch);
    if (patch.country) (await cookies()).set(COUNTRY_COOKIE, cart.country, cookieOpts(365));
    return cart;
  });
}

export async function getCartAction() {
  return run(async () => (await api()).cart.get(await ensureCart()));
}

/** Market selector in the header: country decides currency & VAT shown. */
export async function setCountry(country: string) {
  const jar = await cookies();
  jar.set(COUNTRY_COOKIE, country, cookieOpts(365));
  const cartId = jar.get(CART_COOKIE)?.value;
  if (cartId) {
    try {
      await (await api()).cart.update(cartId, { country });
    } catch {
      /* closed cart */
    }
  }
  revalidatePath('/', 'layout');
}

export async function placeOrder(input: Omit<CheckoutInput, 'cartId'>): Promise<ActionResult<CheckoutResult>> {
  return run(async () => {
    const jar = await cookies();
    const cartId = await ensureCart();
    const res = await (await api()).checkout({ ...input, cartId });
    jar.delete(CART_COOKIE);
    if (res.session) jar.set(SESSION_COOKIE, res.session.token, cookieOpts(30));
    return res;
  });
}

export async function mockPay(orderId: string, token: string, outcome: 'success' | 'failure') {
  return run(async () => (await api()).payments.mockConfirm(orderId, token, outcome));
}

export async function login(email: string, password: string, claim?: { orderId: string; token: string }) {
  return run(async () => {
    const res = await (await api()).auth.login({ email, password, claim });
    (await cookies()).set(SESSION_COOKIE, res.token, cookieOpts(30));
    revalidatePath('/', 'layout');
    return res.customer;
  });
}

export async function register(input: { email: string; password: string; firstName?: string; lastName?: string; marketingConsent?: boolean; claim?: { orderId: string; token: string } }) {
  return run(async () => {
    const res = await (await api()).auth.register({ ...input, locale: await getLocale() });
    (await cookies()).set(SESSION_COOKIE, res.token, cookieOpts(30));
    revalidatePath('/', 'layout');
    return res.customer;
  });
}

export async function logout() {
  const jar = await cookies();
  try {
    await (await api()).auth.logout();
  } catch {
    /* ignore */
  }
  jar.delete(SESSION_COOKIE);
  revalidatePath('/', 'layout');
}

export async function completeLesson(entitlementId: string, lessonId: string) {
  return run(async () => {
    await (await api()).me.completeLesson(entitlementId, lessonId);
    revalidatePath('/account');
    return true;
  });
}

export async function cancelSubscription(id: string) {
  return run(async () => {
    const s = await (await api()).me.cancelSubscription(id);
    revalidatePath('/account');
    return s;
  });
}

export async function submitReview(slug: string, rating: number, title: string, body: string) {
  return run(async () => {
    const r = await (await api()).catalog.review(slug, { rating, title, body });
    revalidatePath(`/products/${slug}`);
    return r;
  });
}

export async function adminAction(kind: 'markPaid' | 'ship' | 'cancel', orderId: string, itemId?: string) {
  return run(async () => {
    const c = await api();
    const res = kind === 'markPaid' ? await c.admin.markPaid(orderId) : kind === 'ship' ? await c.admin.ship(orderId, itemId!) : await c.admin.cancel(orderId);
    revalidatePath('/admin');
    return res;
  });
}
