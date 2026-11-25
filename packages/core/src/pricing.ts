import { allocate, type BasisPoints, type Currency } from './money.js';
import { applyCoupon, type Coupon, type CouponProblem } from './discounts.js';
import type { ProductKind } from './product-kinds.js';
import { quoteShipping, type ShippingQuote, type ShippingZone } from './shipping.js';
import { adjustGrossPrice, lookupRate, resolveTax, taxFromGross, type TaxCategory, type TaxContext, type TaxSettings, type TaxTreatment } from './tax.js';

export interface PricingLineInput {
  id: string;
  productId: string;
  variantId: string;
  kind: ProductKind;
  quantity: number;
  /** Stored gross unit price incl. origin-country VAT, minor units, in `currency`. */
  unitPrice: number;
  taxCategory: TaxCategory;
  priceBound: boolean;
  requiresShipping: boolean;
  weightGrams: number;
  categoryIds: string[];
}

export interface PricingInput {
  currency: Currency;
  lines: PricingLineInput[];
  tax: TaxSettings;
  taxContext: TaxContext;
  coupon?: Coupon;
  shippingZones: ShippingZone[];
  shippingRateId?: string;
  now?: Date;
}

export interface PricedLine {
  id: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discount: number;
  total: number;
  taxRate: BasisPoints;
  taxAmount: number;
  taxTreatment: TaxTreatment;
  taxCountry?: string;
}

export interface TaxLine {
  rate: BasisPoints;
  country?: string;
  gross: number;
  net: number;
  tax: number;
}

export interface PricingNotice {
  code: 'coupon_problem' | 'price_bound_excluded' | 'tax_rate_fallback' | 'shipping_unavailable';
  detail?: string;
  lineIds?: string[];
}

export interface PricingResult {
  currency: Currency;
  lines: PricedLine[];
  subtotal: number;
  discountTotal: number;
  shipping: { required: boolean; selected?: ShippingQuote; options: ShippingQuote[]; amount: number; taxAmount: number };
  taxLines: TaxLine[];
  taxTotal: number;
  total: number;
  invoiceNotes: string[];
  notices: PricingNotice[];
  coupon?: { code: string; applied: boolean; problem?: CouponProblem };
}

/**
 * Price a cart. Pure & deterministic: same input → same output. All amounts are
 * gross (VAT-inclusive) minor units, as required for B2C price display in DACH (PAngV).
 */
export function priceCart(input: PricingInput): PricingResult {
  const { currency, tax, taxContext } = input;
  const notices: PricingNotice[] = [];
  const invoiceNotes = new Set<string>();

  // 1) resolve tax + destination-adjusted unit prices
  const resolved = input.lines.map((l) => {
    const res = resolveTax(l.taxCategory, taxContext, tax);
    const originRate = tax.smallBusiness ? 0 : lookupRate(tax.originCountry, l.taxCategory, tax).rate;
    const unitPrice = adjustGrossPrice(l.unitPrice, originRate, res.rate, tax.priceStrategy, res.treatment);
    if (res.source === 'fallback') notices.push({ code: 'tax_rate_fallback', detail: `${res.taxCountry}:${l.taxCategory}`, lineIds: [l.id] });
    if (res.invoiceNote) invoiceNotes.add(res.invoiceNote);
    return { line: l, res, unitPrice, lineTotal: unitPrice * l.quantity };
  });

  // 2) discounts
  const discount = applyCoupon(
    input.coupon,
    resolved.map((r) => ({ id: r.line.id, kind: r.line.kind, lineTotal: r.lineTotal, priceBound: r.line.priceBound, categoryIds: r.line.categoryIds })),
    currency,
    input.now,
  );
  if (discount.problem) notices.push({ code: 'coupon_problem', detail: discount.problem });
  if (discount.excludedPriceBound.length) notices.push({ code: 'price_bound_excluded', lineIds: discount.excludedPriceBound });

  const lines: PricedLine[] = resolved.map((r) => {
    const d = discount.allocations[r.line.id] ?? 0;
    const total = r.lineTotal - d;
    return {
      id: r.line.id,
      quantity: r.line.quantity,
      unitPrice: r.unitPrice,
      lineTotal: r.lineTotal,
      discount: d,
      total,
      taxRate: r.res.rate,
      taxAmount: taxFromGross(total, r.res.rate),
      taxTreatment: r.res.treatment,
      taxCountry: r.res.taxCountry,
    };
  });

  // 3) shipping
  const shippable = resolved.map((r, i) => ({ r, priced: lines[i]! })).filter((x) => x.r.line.requiresShipping);
  const shippingRequired = shippable.length > 0;
  let options: ShippingQuote[] = [];
  let selected: ShippingQuote | undefined;
  let shippingAmount = 0;
  let shippingTax = 0;
  const shippingTaxByRate = new Map<string, { rate: number; country?: string; gross: number; tax: number }>();

  if (shippingRequired) {
    const shippableSubtotal = shippable.reduce((s, x) => s + x.priced.total, 0);
    const weight = shippable.reduce((s, x) => s + x.r.line.weightGrams * x.r.line.quantity, 0);
    options = quoteShipping(input.shippingZones, taxContext.destinationCountry, currency, shippableSubtotal, weight);
    if (discount.freeShipping) options = options.map((o) => ({ ...o, amount: 0, free: true }));
    selected = options.find((o) => o.rateId === input.shippingRateId) ?? options[0];
    if (!selected) {
      notices.push({ code: 'shipping_unavailable', detail: taxContext.destinationCountry });
    } else {
      shippingAmount = selected.amount;
      // Shipping is an ancillary service (Nebenleistung): it shares the VAT rate(s) of
      // the shipped goods, split proportionally when goods carry different rates.
      const weights = shippable.map((x) => Math.max(x.priced.total, 0));
      const parts = allocate(shippingAmount, weights.every((w) => w === 0) ? weights.map(() => 1) : weights);
      shippable.forEach((x, i) => {
        const part = parts[i]!;
        const key = `${x.priced.taxRate}|${x.priced.taxCountry ?? ''}`;
        const entry = shippingTaxByRate.get(key) ?? { rate: x.priced.taxRate, country: x.priced.taxCountry, gross: 0, tax: 0 };
        entry.gross += part;
        shippingTaxByRate.set(key, entry);
      });
      for (const e of shippingTaxByRate.values()) {
        e.tax = taxFromGross(e.gross, e.rate);
        shippingTax += e.tax;
      }
    }
  }

  // 4) tax lines
  const taxMap = new Map<string, TaxLine>();
  const addTax = (rate: number, country: string | undefined, gross: number, taxAmt: number) => {
    const key = `${rate}|${country ?? ''}`;
    const tl = taxMap.get(key) ?? { rate, country, gross: 0, net: 0, tax: 0 };
    tl.gross += gross;
    tl.tax += taxAmt;
    tl.net = tl.gross - tl.tax;
    taxMap.set(key, tl);
  };
  for (const l of lines) addTax(l.taxRate, l.taxCountry, l.total, l.taxAmount);
  for (const e of shippingTaxByRate.values()) addTax(e.rate, e.country, e.gross, e.tax);
  const taxLines = [...taxMap.values()].sort((a, b) => b.rate - a.rate);

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const discountTotal = discount.total;
  const taxTotal = taxLines.reduce((s, t) => s + t.tax, 0);

  return {
    currency,
    lines,
    subtotal,
    discountTotal,
    shipping: { required: shippingRequired, selected, options, amount: shippingAmount, taxAmount: shippingTax },
    taxLines,
    taxTotal,
    total: subtotal - discountTotal + shippingAmount,
    invoiceNotes: [...invoiceNotes],
    notices,
    coupon: input.coupon ? { code: input.coupon.code, applied: !discount.problem, problem: discount.problem } : undefined,
  };
}
