import { describe, expect, it } from 'vitest';
import {
  allocate,
  applyCoupon,
  canTransition,
  consentRequirements,
  deriveFulfillmentStatus,
  diagramSceneSchema,
  digitalAccessStartsAt,
  formatMoney,
  formatOrderNumber,
  licenseKey,
  negotiateLocale,
  priceCart,
  resolveTax,
  roundHalfUp,
  slugify,
  t,
  taxFromGross,
  unitPrice,
  validateConsents,
  type PricingInput,
  type PricingLineInput,
  type ShippingZone,
  type TaxSettings,
} from '../src/index.js';

const TAX: TaxSettings = { originCountry: 'DE', oss: true, registrations: ['CH'], smallBusiness: false, priceStrategy: 'gross-constant' };

const ZONES: ShippingZone[] = [
  {
    id: 'de',
    name: { de: 'Deutschland' },
    countries: ['DE'],
    rates: [
      { id: 'dhl', name: { de: 'DHL Paket' }, price: { EUR: 495 }, freeAbove: { EUR: 5000 }, minDays: 1, maxDays: 3 },
      { id: 'express', name: { de: 'Express' }, price: { EUR: 1290 }, minDays: 1, maxDays: 1 },
    ],
  },
  { id: 'at', name: { de: 'Österreich' }, countries: ['AT'], rates: [{ id: 'post-at', name: { de: 'Post' }, price: { EUR: 790 }, minDays: 2, maxDays: 5 }] },
  { id: 'ch', name: { de: 'Schweiz' }, countries: ['CH'], rates: [{ id: 'post-ch', name: { de: 'Post CH' }, price: { CHF: 1490 }, minDays: 3, maxDays: 7 }] },
];

function line(p: Partial<PricingLineInput> & Pick<PricingLineInput, 'id'>): PricingLineInput {
  return { productId: p.id, variantId: p.id, kind: 'physical', quantity: 1, unitPrice: 1000, taxCategory: 'standard', priceBound: false, requiresShipping: true, weightGrams: 500, categoryIds: [], ...p };
}

function cart(lines: PricingLineInput[], over: Partial<PricingInput> = {}): PricingInput {
  return { currency: 'EUR', lines, tax: TAX, taxContext: { destinationCountry: 'DE', customerType: 'b2c' }, shippingZones: ZONES, ...over };
}

describe('money', () => {
  it('rounds half away from zero', () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(roundHalfUp(2.4999999999)).toBe(3); // float artefact guard
    expect(roundHalfUp(2.49)).toBe(2);
  });
  it('allocates without losing cents', () => {
    const parts = allocate(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
    expect(allocate(10, [0, 0])).toEqual([10, 0]);
  });
  it('formats German currency', () => {
    expect(formatMoney({ amount: 123456, currency: 'EUR' }, 'de-DE')).toMatch(/1\.234,56\s€/);
  });
});

describe('i18n', () => {
  it('falls back to German', () => {
    expect(t({ de: 'Buch' }, 'en')).toBe('Buch');
    expect(t({ de: 'Buch', en: 'Book' }, 'en')).toBe('Book');
  });
  it('negotiates locales', () => {
    expect(negotiateLocale('en-US,en;q=0.9,de;q=0.8', ['de', 'en'], 'de')).toBe('en');
    expect(negotiateLocale('fr-FR', ['de', 'en'], 'de')).toBe('de');
    expect(negotiateLocale(undefined, ['de', 'en'], 'de')).toBe('de');
  });
});

describe('tax', () => {
  it('extracts VAT from gross prices', () => {
    expect(taxFromGross(11900, 1900)).toBe(1900);
    expect(taxFromGross(10700, 700)).toBe(700);
    expect(taxFromGross(999, 1900)).toBe(160);
  });
  it('domestic German rates', () => {
    expect(resolveTax('books', { destinationCountry: 'DE', customerType: 'b2c' }, TAX)).toMatchObject({ rate: 700, treatment: 'domestic' });
    expect(resolveTax('ebooks', { destinationCountry: 'DE', customerType: 'b2c' }, TAX)).toMatchObject({ rate: 700 });
  });
  it('OSS: Austrian consumer pays Austrian VAT', () => {
    expect(resolveTax('standard', { destinationCountry: 'AT', customerType: 'b2c' }, TAX)).toMatchObject({ rate: 2000, treatment: 'oss_destination', taxCountry: 'AT' });
    expect(resolveTax('ebooks', { destinationCountry: 'AT', customerType: 'b2c' }, TAX)).toMatchObject({ rate: 1000 });
  });
  it('without OSS, origin rate applies inside the EU', () => {
    expect(resolveTax('standard', { destinationCountry: 'AT', customerType: 'b2c' }, { ...TAX, oss: false })).toMatchObject({ rate: 1900, treatment: 'origin_rate' });
  });
  it('B2B reverse charge with valid VAT ID', () => {
    const r = resolveTax('standard', { destinationCountry: 'AT', customerType: 'b2b', vatIdValid: true }, TAX);
    expect(r).toMatchObject({ rate: 0, treatment: 'reverse_charge' });
    expect(r.invoiceNote).toMatch(/Reverse Charge/);
  });
  it('Swiss registration charges MWST, otherwise export', () => {
    expect(resolveTax('standard', { destinationCountry: 'CH', customerType: 'b2c' }, TAX)).toMatchObject({ rate: 810, treatment: 'registered_destination' });
    expect(resolveTax('standard', { destinationCountry: 'US', customerType: 'b2c' }, TAX)).toMatchObject({ rate: 0, treatment: 'export' });
  });
  it('Kleinunternehmer (§ 19 UStG)', () => {
    expect(resolveTax('standard', { destinationCountry: 'DE', customerType: 'b2c' }, { ...TAX, smallBusiness: true })).toMatchObject({ rate: 0, treatment: 'small_business' });
  });
  it('local consulting stays at origin for B2C', () => {
    expect(resolveTax('services', { destinationCountry: 'FR', customerType: 'b2c' }, TAX)).toMatchObject({ rate: 1900, treatment: 'origin_rate' });
  });
});

describe('priceCart', () => {
  it('prices a simple German cart with shipping', () => {
    const r = priceCart(cart([line({ id: 'a', unitPrice: 2999, quantity: 1 })]));
    expect(r.subtotal).toBe(2999);
    expect(r.shipping.amount).toBe(495);
    expect(r.total).toBe(3494);
    expect(r.taxTotal).toBe(taxFromGross(3494, 1900));
    expect(r.taxLines).toHaveLength(1);
  });

  it('free shipping above threshold and cheapest rate preselected', () => {
    const r = priceCart(cart([line({ id: 'a', unitPrice: 5000 })]));
    expect(r.shipping.selected?.rateId).toBe('dhl');
    expect(r.shipping.amount).toBe(0);
  });

  it('splits shipping VAT across mixed rates (Nebenleistung)', () => {
    const r = priceCart(cart([line({ id: 'book', kind: 'book', taxCategory: 'books', unitPrice: 2000 }), line({ id: 'mug', unitPrice: 2000 })]));
    expect(r.shipping.amount).toBe(495);
    const seven = r.taxLines.find((t) => t.rate === 700)!;
    const nineteen = r.taxLines.find((t) => t.rate === 1900)!;
    expect(seven.gross + nineteen.gross).toBe(r.total);
    expect(seven.gross).toBe(2000 + 248);
    expect(nineteen.gross).toBe(2000 + 247);
  });

  it('digital-only carts need no shipping', () => {
    const r = priceCart(cart([line({ id: 'eb', kind: 'ebook', taxCategory: 'ebooks', requiresShipping: false, unitPrice: 1999 })]));
    expect(r.shipping.required).toBe(false);
    expect(r.total).toBe(1999);
    expect(r.taxTotal).toBe(taxFromGross(1999, 700));
  });

  it('Buchpreisbindung: price-bound books are never discounted', () => {
    const coupon = { code: 'SAVE10', type: 'percent' as const, value: 1000, usedCount: 0, active: true };
    const r = priceCart(cart([line({ id: 'book', kind: 'book', taxCategory: 'books', priceBound: true, unitPrice: 3000 }), line({ id: 'gadget', unitPrice: 2000 })], { coupon }));
    expect(r.lines.find((l) => l.id === 'book')!.discount).toBe(0);
    expect(r.lines.find((l) => l.id === 'gadget')!.discount).toBe(200);
    expect(r.notices.some((n) => n.code === 'price_bound_excluded')).toBe(true);
  });

  it('coupon on only price-bound books reports a problem', () => {
    const coupon = { code: 'SAVE10', type: 'percent' as const, value: 1000, usedCount: 0, active: true };
    const r = priceCart(cart([line({ id: 'book', kind: 'book', priceBound: true })], { coupon }));
    expect(r.discountTotal).toBe(0);
    expect(r.coupon).toMatchObject({ applied: false, problem: 'no_eligible_items' });
  });

  it('free-shipping coupons are allowed for price-bound books', () => {
    const coupon = { code: 'SHIPFREE', type: 'free_shipping' as const, value: 0, usedCount: 0, active: true };
    const r = priceCart(cart([line({ id: 'book', kind: 'book', priceBound: true, unitPrice: 1500 })], { coupon }));
    expect(r.shipping.amount).toBe(0);
  });

  it('OSS with gross-constant keeps the shelf price but changes the tax', () => {
    const r = priceCart(cart([line({ id: 'a', unitPrice: 11900, requiresShipping: false })], { taxContext: { destinationCountry: 'AT', customerType: 'b2c' } }));
    expect(r.total).toBe(11900);
    expect(r.taxTotal).toBe(taxFromGross(11900, 2000));
  });

  it('net-constant strategy recomputes the gross price', () => {
    const r = priceCart(cart([line({ id: 'a', unitPrice: 11900, requiresShipping: false })], { tax: { ...TAX, priceStrategy: 'net-constant' }, taxContext: { destinationCountry: 'AT', customerType: 'b2c' } }));
    expect(r.total).toBe(12000);
  });

  it('exports are charged net', () => {
    const r = priceCart(cart([line({ id: 'a', unitPrice: 11900, requiresShipping: false })], { taxContext: { destinationCountry: 'US', customerType: 'b2c' } }));
    expect(r.total).toBe(10000);
    expect(r.taxTotal).toBe(0);
    expect(r.invoiceNotes.length).toBe(1);
  });

  it('flags missing shipping zone', () => {
    const r = priceCart(cart([line({ id: 'a' })], { taxContext: { destinationCountry: 'JP', customerType: 'b2c' } }));
    expect(r.notices.some((n) => n.code === 'shipping_unavailable')).toBe(true);
  });

  it('fixed coupons respect min subtotal & currency', () => {
    const c = { code: 'TEN', type: 'fixed' as const, value: 1000, currency: 'EUR' as const, minSubtotal: 5000, usedCount: 0, active: true };
    expect(applyCoupon(c, [{ id: 'a', kind: 'physical', lineTotal: 4000, priceBound: false, categoryIds: [] }], 'EUR').problem).toBe('min_subtotal_not_reached');
    expect(applyCoupon(c, [{ id: 'a', kind: 'physical', lineTotal: 6000, priceBound: false, categoryIds: [] }], 'CHF').problem).toBe('currency_mismatch');
    expect(applyCoupon(c, [{ id: 'a', kind: 'physical', lineTotal: 6000, priceBound: false, categoryIds: [] }], 'EUR').total).toBe(1000);
  });
});

describe('legal', () => {
  it('requires terms; offers digital waiver for digital content', () => {
    const keys = consentRequirements(['ebook', 'service']).map((r) => r.key);
    expect(keys).toEqual(['terms', 'digital_waiver', 'service_early_start']);
    expect(validateConsents(['ebook'], {})).toEqual({ ok: false, missing: ['terms'] });
    expect(validateConsents(['ebook'], { terms: true })).toEqual({ ok: true });
  });
  it('delays digital access by 14 days without waiver', () => {
    const paid = new Date('2026-01-01T00:00:00Z');
    expect(digitalAccessStartsAt(paid, true)).toEqual(paid);
    expect(digitalAccessStartsAt(paid, false).toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });
});

describe('orders', () => {
  it('state machine', () => {
    expect(canTransition('pending_payment', 'paid')).toBe(true);
    expect(canTransition('cancelled', 'paid')).toBe(false);
    expect(deriveFulfillmentStatus(['fulfilled', 'unfulfilled'])).toBe('partially_fulfilled');
    expect(deriveFulfillmentStatus(['fulfilled', 'cancelled'])).toBe('fulfilled');
    expect(formatOrderNumber('SF', 2026, 42)).toBe('SF-2026-000042');
  });
});

describe('misc', () => {
  it('slugifies German', () => {
    expect(slugify('Größenwahn & Übermut')).toBe('groessenwahn-uebermut');
  });
  it('license keys', () => {
    expect(licenseKey('SF')).toMatch(/^SF(-[A-Z2-9]{4}){4}$/);
  });
  it('Grundpreis', () => {
    expect(unitPrice(299, { unit: 'g', amount: 250 })).toEqual({ amount: 1196, per: 'kg' });
  });
  it('validates diagram scenes', () => {
    const ok = diagramSceneSchema.safeParse({ id: 'x', version: 1, title: { de: 'X' }, nodes: [{ id: 'a', label: { de: 'A' }, position: [0, 0, 0] }], edges: [{ from: 'a', to: 'b' }] });
    expect(ok.success).toBe(false);
  });
});
