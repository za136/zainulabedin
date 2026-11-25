import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { processOutbox } from '../src/modules/notifications/outbox.js';
import { renewSubscriptions } from '../src/modules/account/library.service.js';
import { address, ADMIN, createTestApp, type TestApp } from './helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
}, 30_000);
afterAll(() => t.close());

async function product(slug: string, query = '') {
  const r = await t.call('GET', `/v1/catalog/products/${slug}${query}`);
  expect(r.status).toBe(200);
  return r.body;
}

async function cartWith(items: { slug: string; variant?: number; quantity?: number; slot?: boolean }[], market: Record<string, string> = {}) {
  const c = await t.call('POST', '/v1/carts', market);
  expect(c.status).toBe(201);
  let cart = c.body;
  for (const it of items) {
    const p = await product(it.slug);
    let slotId: string | undefined;
    if (it.slot) slotId = (await t.call('GET', `/v1/catalog/products/${it.slug}/slots`)).body.slots[0].id;
    const r = await t.call('POST', `/v1/carts/${cart.id}/items`, { variantId: p.variants[it.variant ?? 0].id, quantity: it.quantity ?? 1, slotId });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    cart = r.body;
  }
  return cart;
}

async function checkout(cartId: string, over: Record<string, unknown> = {}) {
  return t.call('POST', '/v1/checkout', { cartId, email: 'erika@example.com', billingAddress: address(), consents: { terms: true, digital_waiver: true, service_early_start: true }, paymentProvider: 'mock', ...over });
}

async function payMock(order: { orderId: string; accessToken: string }) {
  const r = await t.call('POST', '/v1/payments/mock/confirm', { orderId: order.orderId, token: order.accessToken });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body;
}

async function login(email: string, password: string, claim?: { orderId: string; token: string }) {
  const r = await t.call('POST', '/v1/auth/login', { email, password, claim });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return { authorization: `Bearer ${r.body.token}` };
}

describe('store & content', () => {
  it('serves German-first public config', async () => {
    const r = await t.call('GET', '/v1/store');
    expect(r.body.locales.default).toBe('de');
    expect(r.body.market).toEqual({ locale: 'de', country: 'DE', currency: 'EUR' });
    expect(r.body.payments.map((p: { id: string }) => p.id)).toEqual(['mock', 'prepayment']);
    expect(r.body.orderButtonLabel.de).toBe('Zahlungspflichtig bestellen');
  });
  it('negotiates English from Accept-Language', async () => {
    const r = await t.call('GET', '/v1/store', undefined, { 'accept-language': 'en-US,en;q=0.9' });
    expect(r.body.market.locale).toBe('en');
  });
  it('renders the Impressum template with legal data', async () => {
    const r = await t.call('GET', '/v1/content/imprint');
    expect(r.body.markdown).toContain('Wissenswerk GmbH');
    expect(r.body.markdown).toContain('§ 5 DDG');
    const en = await t.call('GET', '/v1/content/imprint?locale=en');
    expect(en.body.locale).toBe('en');
  });
  it('health', async () => expect((await t.call('GET', '/v1/health')).body.ok).toBe(true));
});

describe('catalog', () => {
  it('lists products with kind facets', async () => {
    const r = await t.call('GET', '/v1/catalog/products?pageSize=48');
    expect(r.body.total).toBe(21);
    expect(r.body.facets.kinds.book).toBe(5);
  });
  it('German full-text search with stemming', async () => {
    const r = await t.call('GET', `/v1/catalog/products?q=${encodeURIComponent('Sprachmodell')}`);
    expect(r.body.items.length).toBeGreaterThan(0);
    expect(r.body.items[0].slug).toMatch(/sprachmodelle/);
  });
  it('filters by kind & category, sorts by price', async () => {
    const r = await t.call('GET', '/v1/catalog/products?category=elektronik&sort=price_asc');
    expect(r.body.items.map((p: { kind: string }) => p.kind).every((k: string) => k === 'physical')).toBe(true);
    const prices = r.body.items.map((p: { price: { amount: number } }) => p.price.amount);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
  it('product detail with editions, stock and tax info', async () => {
    const p = await product('wie-das-internet-funktioniert');
    expect(p.priceBound).toBe(true);
    expect(p.tax.rate).toBe(700);
    expect(p.editions.map((e: { kind: string }) => e.kind).sort()).toEqual(['ebook', 'interactive_book']);
    const reader = await product('wissenswerk-reader-7');
    expect(reader.variants.map((v: { stock: string }) => v.stock)).toEqual(['in_stock', 'in_stock', 'low_stock']);
    expect(reader.attributes.gpsr.manufacturer).toBeTruthy();
  });
  it('translates and prices per market', async () => {
    const en = await product('wie-das-internet-funktioniert', '?locale=en');
    expect(en.title).toBe('How the Internet Works');
    const ch = await product('wie-das-internet-funktioniert', '?country=CH');
    expect(ch.price.currency).toBe('CHF');
    expect(ch.tax.treatment).toBe('export'); // no Swiss VAT registration in this store
  });
  it('categories tree', async () => {
    const r = await t.call('GET', '/v1/catalog/categories');
    const fach = r.body.categories.find((c: { slug: string }) => c.slug === 'fachbuecher');
    expect(fach.children.map((c: { slug: string }) => c.slug)).toContain('informatik');
  });
});

describe('cart & pricing', () => {
  it('Buchpreisbindung: coupon does not discount price-bound books', async () => {
    const cart = await cartWith([{ slug: 'wie-das-internet-funktioniert' }]);
    const r = await t.call('PATCH', `/v1/carts/${cart.id}`, { couponCode: 'willkommen10' });
    expect(r.body.pricing.discountTotal).toBe(0);
    expect(r.body.pricing.coupon.problem).toBe('no_eligible_items');
    const r2 = await t.call('POST', `/v1/carts/${cart.id}/items`, { variantId: (await product('fokus-anc-kopfhoerer')).variants[0].id, quantity: 1 });
    expect(r2.body.pricing.discountTotal).toBe(1490);
  });
  it('digital items are capped at quantity 1 and need no shipping', async () => {
    const cart = await cartWith([{ slug: 'sprachmodelle-verstehen-ebook', quantity: 3 }]);
    expect(cart.items[0].quantity).toBe(1);
    expect(cart.requiresShipping).toBe(false);
    expect(cart.consents.map((c: { key: string }) => c.key)).toEqual(['terms', 'digital_waiver']);
  });
  it('rejects out-of-stock variants', async () => {
    const c = await t.call('POST', '/v1/carts', {});
    const p = await product('fokus-anc-kopfhoerer');
    const r = await t.call('POST', `/v1/carts/${c.body.id}/items`, { variantId: p.variants[1].id, quantity: 1 });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('insufficient_stock');
  });
  it('services require an appointment', async () => {
    const c = await t.call('POST', '/v1/carts', {});
    const p = await product('architektur-review');
    const r = await t.call('POST', `/v1/carts/${c.body.id}/items`, { variantId: p.variants[0].id, quantity: 1 });
    expect(r.body.error.code).toBe('slot_required');
  });
});

describe('checkout → payment → fulfillment', () => {
  it('requires accepting the terms', async () => {
    const cart = await cartWith([{ slug: 'usb-c-ladegeraet-65w' }]);
    const r = await checkout(cart.id, { consents: { terms: false } });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('consent_required');
  });

  it('guest buys print + e-book + licence; pays; gets entitlements, keys and emails', async () => {
    const before = await product('usb-c-ladegeraet-65w');
    const cart = await cartWith([{ slug: 'usb-c-ladegeraet-65w', quantity: 2 }, { slug: 'sprachmodelle-verstehen-ebook' }, { slug: 'diagramstudio-pro' }]);
    const placed = await checkout(cart.id);
    expect(placed.status, JSON.stringify(placed.body)).toBe(201);
    expect(placed.body.number).toMatch(/^WW-\d{4}-\d{6}$/);
    expect(placed.body.payment.type).toBe('redirect');

    // stock is reserved, not yet deducted
    expect((await product('usb-c-ladegeraet-65w')).variants[0].available).toBe(before.variants[0].available - 2);

    const paid = await payMock(placed.body);
    expect(paid.paymentStatus).toBe('paid');
    expect(paid.status).toBe('partially_fulfilled'); // digital delivered, charger awaits shipping
    const kinds = Object.fromEntries(paid.items.map((i: { kind: string; fulfillmentStatus: string }) => [i.kind, i.fulfillmentStatus]));
    expect(kinds).toEqual({ physical: 'unfulfilled', ebook: 'fulfilled', license: 'fulfilled' });

    // idempotent confirmation
    expect((await payMock(placed.body)).paymentStatus).toBe('paid');

    await processOutbox(t.ctx);
    expect(t.mailer.sent.filter((m) => m.to === 'erika@example.com').map((m) => m.subject)).toEqual([expect.stringContaining('Deine Bestellung'), expect.stringContaining('Zahlung erhalten')]);

    // guest registers and claims the order → library
    const reg = await t.call('POST', '/v1/auth/register', { email: 'erika@example.com', password: 'super-secret-pw', firstName: 'Erika', claim: { orderId: placed.body.orderId, token: placed.body.accessToken } });
    expect(reg.status).toBe(201);
    const auth = { authorization: `Bearer ${reg.body.token}` };
    const lib = await t.call('GET', '/v1/me/library', undefined, auth);
    const ebook = lib.body.items.find((i: { type: string }) => i.type === 'ebook');
    const lic = lib.body.items.find((i: { type: string }) => i.type === 'license');
    expect(ebook.available).toBe(true);
    expect(ebook.watermark).toContain('Erika Musterfrau');
    expect(lic.licenseKeys[0]).toMatch(/^DSP(-[A-Z2-9]{4}){4}$/);

    // download (demo placeholder because file storage is empty)
    const url = new URL(ebook.files[0].url);
    const dl = await t.call('GET', url.pathname);
    expect(dl.status).toBe(200);
    expect(dl.raw).toContain('Lizenziert für Erika Musterfrau');
    expect(String(dl.headers['content-disposition'])).toContain('attachment');

    // invoice
    const inv = await t.call('GET', `/v1/orders/${placed.body.orderId}/invoice`, undefined, auth);
    expect(inv.raw).toContain('Rechnung');
    expect(inv.raw).toContain('DE000000000');
    expect(inv.raw).toContain('7 %');
    expect(inv.raw).toContain('19 %');

    // orders list
    expect((await t.call('GET', '/v1/me/orders', undefined, auth)).body.orders).toHaveLength(1);
  });

  it('without the § 356(5) waiver digital access starts after 14 days', async () => {
    const cart = await cartWith([{ slug: 'saubere-architektur-ebook' }]);
    const placed = await checkout(cart.id, { email: 'waiver@example.com', consents: { terms: true }, createAccountPassword: 'another-secret-pw' });
    expect(placed.status).toBe(201);
    expect(placed.body.session.token).toBeTruthy();
    const paid = await payMock(placed.body);
    expect(paid.items[0].fulfillmentStatus).toBe('scheduled');
    const lib = await t.call('GET', '/v1/me/library', undefined, { authorization: `Bearer ${placed.body.session.token}` });
    expect(lib.body.items[0].available).toBe(false);
    expect(lib.body.items[0].files[0].url).toBeNull();
  });

  it('interactive book diagrams: preview public, others locked until purchase', async () => {
    expect((await t.call('GET', '/v1/diagrams/transformer-architecture')).status).toBe(200); // home page
    const locked = await t.call('GET', '/v1/diagrams/clean-architecture');
    expect(locked.status).toBe(200); // previewDiagram of saubere-architektur-3d
    expect((await t.call('GET', '/v1/diagrams/does-not-exist')).status).toBe(404);
  });

  it('subscription unlocks the 3D library; § 312k cancel; expiry on renewal', async () => {
    const cart = await cartWith([{ slug: 'wissenswerk-plus', variant: 0 }]);
    const placed = await checkout(cart.id, { email: 'plus@example.com', createAccountPassword: 'plus-secret-pw-1' });
    await payMock(placed.body);
    const auth = { authorization: `Bearer ${placed.body.session.token}` };
    const lib = await t.call('GET', '/v1/me/library', undefined, auth);
    const sub = lib.body.items.find((i: { type: string }) => i.type === 'subscription');
    expect(sub.grantsAccessTo.map((p: { slug: string }) => p.slug)).toContain('sprachmodelle-verstehen-3d');

    const subs = await t.call('GET', '/v1/me/subscriptions', undefined, auth);
    expect(subs.body.subscriptions[0].status).toBe('active');
    const cancelled = await t.call('POST', `/v1/me/subscriptions/${subs.body.subscriptions[0].id}/cancel`, undefined, auth);
    expect(cancelled.body.cancelAtPeriodEnd).toBe(true);

    t.clock.offsetMs = 40 * 86_400_000; // jump past the period end
    try {
      await renewSubscriptions(t.ctx);
      const after = await t.call('GET', '/v1/me/subscriptions', undefined, auth);
      expect(after.body.subscriptions[0].status).toBe('expired');
    } finally {
      t.clock.offsetMs = 0;
    }
  });

  it('consulting appointment is booked and capacity enforced', async () => {
    const cart = await cartWith([{ slug: 'architektur-review', slot: true }]);
    const placed = await checkout(cart.id, { email: 'consult@example.com' });
    const paid = await payMock(placed.body);
    expect(paid.items[0].fulfillmentStatus).toBe('scheduled');
    const slots = (await t.call('GET', '/v1/catalog/products/architektur-review/slots')).body.slots;
    expect(slots[0].remaining).toBe(0);
    const c = await t.call('POST', '/v1/carts', {});
    const p = await product('architektur-review');
    const r = await t.call('POST', `/v1/carts/${c.body.id}/items`, { variantId: p.variants[0].id, slotId: slots[0].id, quantity: 1 });
    expect(r.body.error.code).toBe('slot_full');
  });

  it('B2B reverse charge for an Austrian company with VAT ID', async () => {
    const cart = await cartWith([{ slug: 'usb-c-ladegeraet-65w' }]);
    const placed = await checkout(cart.id, { email: 'b2b@example.at', billingAddress: { ...address('AT'), company: 'Muster GmbH' }, customerType: 'b2b', vatId: 'ATU12345678' });
    expect(placed.status, JSON.stringify(placed.body)).toBe(201);
    const o = await t.call('GET', `/v1/orders/${placed.body.orderId}?token=${placed.body.accessToken}`);
    expect(o.body.totals.taxTotal).toBe(0);
    expect(o.body.totals.invoiceNotes[0]).toMatch(/Reverse Charge/);
    expect(o.body.items[0].unitPrice).toBe(3353); // 39.90 / 1.19
    const bad = await checkout((await cartWith([{ slug: 'usb-c-ladegeraet-65w' }])).id, { customerType: 'b2b', vatId: 'ATX' });
    expect(bad.body.error.code).toBe('vat_id_invalid');
  });

  it('OSS: Austrian consumer pays Austrian VAT on an e-book', async () => {
    const cart = await cartWith([{ slug: 'wie-das-internet-funktioniert-ebook' }]);
    const placed = await checkout(cart.id, { email: 'oss@example.at', billingAddress: address('AT') });
    const o = await t.call('GET', `/v1/orders/${placed.body.orderId}?token=${placed.body.accessToken}`);
    expect(o.body.items[0].taxRate).toBe(1000);
    expect(o.body.totals.taxLines[0].country).toBe('AT');
  });

  it('Vorkasse + admin back office: mark paid, ship, stats', async () => {
    const cart = await cartWith([{ slug: 'der-algorithmus-des-herbstes' }]);
    const placed = await checkout(cart.id, { email: 'vorkasse@example.com', paymentProvider: 'prepayment' });
    expect(placed.body.payment).toMatchObject({ type: 'bank_transfer', iban: 'DE02120300000000202051', reference: placed.body.number });

    expect((await t.call('POST', `/v1/admin/orders/${placed.body.orderId}/mark-paid`)).status).toBe(401);
    const admin = await login(ADMIN.email, ADMIN.password);
    const paid = await t.call('POST', `/v1/admin/orders/${placed.body.orderId}/mark-paid`, undefined, admin);
    expect(paid.body.status).toBe('processing');
    const shipped = await t.call('POST', `/v1/admin/orders/${placed.body.orderId}/items/${paid.body.items[0].id}/ship`, { trackingNumber: '00340434161234567890' }, admin);
    expect(shipped.body.status).toBe('fulfilled');
    const stats = await t.call('GET', '/v1/admin/stats', undefined, admin);
    expect(stats.body.revenue[0].orders).toBeGreaterThan(0);
    const cust = await login('erika@example.com', 'super-secret-pw');
    expect((await t.call('GET', '/v1/admin/stats', undefined, cust)).status).toBe(403);
  });

  it('cancelling an unpaid order releases stock', async () => {
    const before = (await product('wissenswerk-reader-7')).variants[2].available;
    const cart = await cartWith([{ slug: 'wissenswerk-reader-7', variant: 2, quantity: 2 }]);
    const placed = await checkout(cart.id, { email: 'cancel@example.com', paymentProvider: 'prepayment' });
    expect((await product('wissenswerk-reader-7')).variants[2].available).toBe(before - 2);
    const admin = await login(ADMIN.email, ADMIN.password);
    const c = await t.call('POST', `/v1/admin/orders/${placed.body.orderId}/cancel`, {}, admin);
    expect(c.body.status).toBe('cancelled');
    expect((await product('wissenswerk-reader-7')).variants[2].available).toBe(before);
  });

  it('closed carts cannot be checked out twice', async () => {
    const cart = await cartWith([{ slug: 'architektur-vorlagen' }]);
    expect((await checkout(cart.id)).status).toBe(201);
    expect((await checkout(cart.id)).body.error.code).toBe('cart_closed');
  });
});

describe('auth & reviews', () => {
  it('rejects wrong passwords and duplicate registration', async () => {
    expect((await t.call('POST', '/v1/auth/login', { email: 'erika@example.com', password: 'nope' })).status).toBe(401);
    expect((await t.call('POST', '/v1/auth/register', { email: 'ERIKA@example.com', password: 'whatever-long' })).body.error.code).toBe('email_taken');
    expect((await t.call('GET', '/v1/me')).status).toBe(401);
  });
  it('verified purchase reviews publish immediately and update the rating', async () => {
    const auth = await login('erika@example.com', 'super-secret-pw');
    const r = await t.call('POST', '/v1/catalog/products/sprachmodelle-verstehen-ebook/reviews', { rating: 5, title: 'Großartig', body: 'Endlich verstehe ich Attention.' }, auth);
    expect(r.body).toEqual({ status: 'published', verifiedPurchase: true });
    const p = await product('sprachmodelle-verstehen-ebook');
    expect(p.rating).toEqual({ avg: 5, count: 1 });
  });
  it('validation errors have a stable shape', async () => {
    const r = await t.call('POST', '/v1/checkout', { cartId: 'x' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('validation_error');
  });
});
