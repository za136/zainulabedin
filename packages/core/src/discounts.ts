import { z } from 'zod';
import { allocate, percentOf } from './money.js';
import { PRODUCT_KINDS, type ProductKind } from './product-kinds.js';
import type { Currency } from './money.js';

export const couponSchema = z.object({
  code: z.string().min(2).transform((s) => s.toUpperCase()),
  type: z.enum(['percent', 'fixed', 'free_shipping']),
  /** percent: basis points (1000 = 10 %); fixed: minor units in `currency` */
  value: z.number().int().nonnegative(),
  currency: z.enum(['EUR', 'CHF', 'USD', 'GBP']).optional(),
  minSubtotal: z.number().int().nonnegative().optional(),
  appliesToKinds: z.array(z.enum(PRODUCT_KINDS as [ProductKind, ...ProductKind[]])).optional(),
  appliesToCategories: z.array(z.string()).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  usageLimit: z.number().int().positive().optional(),
  usedCount: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
});
export type Coupon = z.infer<typeof couponSchema>;

export interface DiscountableLine {
  id: string;
  kind: ProductKind;
  lineTotal: number; // gross minor units before discount
  priceBound: boolean;
  categoryIds: string[];
}

export type CouponProblem =
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'usage_limit_reached'
  | 'currency_mismatch'
  | 'min_subtotal_not_reached'
  | 'no_eligible_items';

export interface DiscountResult {
  /** per line discount (gross minor units) */
  allocations: Record<string, number>;
  total: number;
  freeShipping: boolean;
  problem?: CouponProblem;
  /** lines excluded only because of fixed book prices (Buchpreisbindung) */
  excludedPriceBound: string[];
}

/**
 * Apply a coupon to cart lines.
 *
 * Buchpreisbindung: Price-bound books/e-books (BuchPrG § 3, AT BPrBG) must be sold at
 * the publisher's fixed retail price — they are never discounted by percent/fixed
 * coupons. Free shipping remains allowed.
 */
export function applyCoupon(coupon: Coupon | undefined, lines: DiscountableLine[], currency: Currency, now = new Date()): DiscountResult {
  const none: DiscountResult = { allocations: {}, total: 0, freeShipping: false, excludedPriceBound: [] };
  if (!coupon) return none;
  if (!coupon.active) return { ...none, problem: 'inactive' };
  if (coupon.startsAt && now < coupon.startsAt) return { ...none, problem: 'not_started' };
  if (coupon.endsAt && now > coupon.endsAt) return { ...none, problem: 'expired' };
  if (coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) return { ...none, problem: 'usage_limit_reached' };
  if (coupon.type === 'fixed' && coupon.currency && coupon.currency !== currency) return { ...none, problem: 'currency_mismatch' };

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  if (coupon.minSubtotal !== undefined && subtotal < coupon.minSubtotal) return { ...none, problem: 'min_subtotal_not_reached' };

  if (coupon.type === 'free_shipping') return { ...none, freeShipping: true };

  const matchesScope = (l: DiscountableLine) =>
    (!coupon.appliesToKinds || coupon.appliesToKinds.includes(l.kind)) &&
    (!coupon.appliesToCategories || l.categoryIds.some((c) => coupon.appliesToCategories!.includes(c)));

  const inScope = lines.filter(matchesScope);
  const excludedPriceBound = inScope.filter((l) => l.priceBound).map((l) => l.id);
  const eligible = inScope.filter((l) => !l.priceBound && l.lineTotal > 0);
  if (eligible.length === 0) return { ...none, problem: 'no_eligible_items', excludedPriceBound };

  const eligibleTotal = eligible.reduce((s, l) => s + l.lineTotal, 0);
  const total = coupon.type === 'percent' ? Math.min(eligibleTotal, percentOf(eligibleTotal, coupon.value)) : Math.min(eligibleTotal, coupon.value);
  const parts = allocate(total, eligible.map((l) => l.lineTotal));
  const allocations: Record<string, number> = {};
  eligible.forEach((l, i) => (allocations[l.id] = parts[i]!));
  return { allocations, total, freeShipping: false, excludedPriceBound };
}
