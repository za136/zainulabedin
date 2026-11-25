import { and, eq, gt, lte, sql } from 'drizzle-orm';
import { formatOrderNumber, id, validateConsents, type ConsentKey } from '@factory/core';
import { schema as s, type AddressData, type Database, type OrderTotals } from '@factory/db';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { badRequest, conflict } from '../../lib/errors.js';
import { hashPassword, randomToken, sha256 } from '../../lib/security.js';
import { getCart, priceCartRow } from '../cart/cart.service.js';
import { emit } from '../notifications/outbox.js';
import { markOrderPaid } from '../orders/orders.service.js';
import type { PaymentAction } from '../payments/registry.js';
import { normalizeVatId } from './vat.js';

export const addressSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  company: z.string().trim().max(200).optional(),
  street: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  zip: z.string().trim().min(3).max(12),
  city: z.string().trim().min(1).max(100),
  country: z.string().length(2).toUpperCase(),
  phone: z.string().trim().max(40).optional(),
});

export const checkoutSchema = z.object({
  cartId: z.string(),
  email: z.string().trim().toLowerCase().email(),
  billingAddress: addressSchema,
  shippingAddress: addressSchema.optional(),
  customerType: z.enum(['b2c', 'b2b']).default('b2c'),
  vatId: z.string().optional(),
  consents: z.object({ terms: z.boolean(), digital_waiver: z.boolean().optional(), service_early_start: z.boolean().optional() }),
  paymentProvider: z.string(),
  /** create an account with this password during checkout */
  createAccountPassword: z.string().min(10).max(200).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export interface CheckoutResult {
  orderId: string;
  number: string;
  accessToken: string;
  total: number;
  currency: string;
  payment: PaymentAction;
}

/**
 * Place an order from a cart. All-or-nothing: re-prices the cart, validates legal
 * consents, reserves stock & appointment slots atomically, allocates a gap-free order
 * number and writes the order + outbox event in a single transaction. The payment
 * provider is called after commit.
 */
export async function placeOrder(ctx: AppContext, input: CheckoutInput, opts: { customerId?: string; ip?: string } = {}): Promise<CheckoutResult> {
  const provider = ctx.payments.get(input.paymentProvider);
  if (!provider) throw badRequest('payment_provider_unavailable');

  const shipTo = input.shippingAddress ?? input.billingAddress;
  // B2B reverse charge only with a validated VAT ID and only if the store allows B2B
  let vatIdValid = false;
  let vatId: string | undefined;
  if (input.customerType === 'b2b' && input.vatId) {
    if (!ctx.store.config.features.b2b) throw badRequest('b2b_disabled');
    vatId = normalizeVatId(input.vatId);
    vatIdValid = (await ctx.vat.validate(vatId)).valid;
    if (!vatIdValid) throw badRequest('vat_id_invalid', 'The VAT ID could not be validated');
  }

  const accessToken = randomToken(24);

  const result = await ctx.db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Database;
    const cart = await getCart(tx, input.cartId);
    if (cart.status !== 'open') throw conflict('cart_closed');
    // Price for the actual destination & customer type (may differ from the cart preview)
    if (cart.country !== shipTo.country) await tx.update(s.carts).set({ country: shipTo.country }).where(eq(s.carts.id, cart.id));
    const fresh = { ...cart, country: shipTo.country };
    const { lines, pricing } = await priceCartRow(ctx, fresh, { customerType: input.customerType, vatIdValid }, tx);
    if (lines.length === 0) throw badRequest('cart_empty');
    if (lines.some((l) => !l.available)) throw conflict('unavailable_items', 'Some items are no longer available');
    if (pricing.notices.some((n) => n.code === 'shipping_unavailable')) throw badRequest('shipping_unavailable', `We do not ship to ${shipTo.country}`);
    if (pricing.shipping.required && !input.shippingAddress && !input.billingAddress) throw badRequest('shipping_address_required');

    const kinds = [...new Set(lines.map((l) => l.kind))];
    const consentCheck = validateConsents(kinds, input.consents);
    if (!consentCheck.ok) throw badRequest('consent_required', 'Required consents missing', { missing: consentCheck.missing });

    // atomic stock reservation
    for (const l of lines) {
      const reserved = await tx
        .update(s.variants)
        .set({ stockReserved: sql`${s.variants.stockReserved} + ${l.quantity}` })
        .where(and(eq(s.variants.id, l.variantId), sql`(${s.variants.stockOnHand} is null or ${s.variants.stockOnHand} - ${s.variants.stockReserved} >= ${l.quantity})`))
        .returning({ id: s.variants.id });
      if (reserved.length === 0) throw conflict('insufficient_stock', `${l.title} is out of stock`, { variantId: l.variantId });
      if (l.kind === 'service') {
        if (!l.slot) throw badRequest('slot_required');
        const booked = await tx
          .update(s.serviceSlots)
          .set({ booked: sql`${s.serviceSlots.booked} + ${l.quantity}` })
          .where(and(eq(s.serviceSlots.id, l.slot.id), gt(s.serviceSlots.startsAt, ctx.now()), sql`${s.serviceSlots.booked} + ${l.quantity} <= ${s.serviceSlots.capacity}`))
          .returning({ id: s.serviceSlots.id });
        if (booked.length === 0) throw conflict('slot_full', 'The selected appointment is no longer available');
      }
    }

    // customer account
    let customerId = opts.customerId ?? null;
    if (!customerId && input.createAccountPassword) {
      const exists = await tx.query.customers.findFirst({ where: sql`lower(${s.customers.email}) = ${input.email}` });
      if (exists) throw conflict('email_taken', 'An account with this email exists — please log in');
      customerId = id('cus');
      await tx.insert(s.customers).values({
        id: customerId,
        email: input.email,
        passwordHash: await hashPassword(input.createAccountPassword),
        firstName: input.billingAddress.firstName,
        lastName: input.billingAddress.lastName,
        company: input.billingAddress.company ?? null,
        locale: cart.locale,
      });
      await emit(tx, { type: 'customer.registered', payload: { customerId } });
    }

    // gap-free order number per year (§ 14 UStG)
    const year = ctx.now().getUTCFullYear();
    const counter = await tx.execute(sql`insert into counters (name, value) values (${'order-' + year}, 1)
      on conflict (name) do update set value = counters.value + 1 returning value`);
    const seq = Number((counter.rows[0] as { value: number }).value);
    const number = formatOrderNumber(ctx.store.config.orders.numberPrefix, year, seq);

    const totals: OrderTotals = {
      subtotal: pricing.subtotal,
      discountTotal: pricing.discountTotal,
      shipping: pricing.shipping.amount,
      taxTotal: pricing.taxTotal,
      total: pricing.total,
      taxLines: pricing.taxLines,
      invoiceNotes: pricing.invoiceNotes,
      shippingRate: pricing.shipping.selected
        ? { id: pricing.shipping.selected.rateId, name: pricing.shipping.selected.name, minDays: pricing.shipping.selected.minDays, maxDays: pricing.shipping.selected.maxDays }
        : undefined,
    };

    const orderId = id('ord');
    await tx.insert(s.orders).values({
      id: orderId,
      number,
      customerId,
      email: input.email,
      status: 'pending_payment',
      paymentStatus: 'pending',
      currency: cart.currency,
      locale: cart.locale,
      country: shipTo.country,
      customerType: input.customerType,
      vatId: vatId ?? null,
      billingAddress: input.billingAddress as AddressData,
      shippingAddress: pricing.shipping.required ? (shipTo as AddressData) : null,
      totals,
      couponCode: pricing.coupon?.applied ? pricing.coupon.code : null,
      consents: { ...(input.consents as Partial<Record<ConsentKey, boolean>>), at: ctx.now().toISOString(), ip: opts.ip },
      paymentProvider: provider.id,
      accessTokenHash: sha256(accessToken),
      placedAt: ctx.now(),
    });

    const priced = new Map(pricing.lines.map((p) => [p.id, p]));
    await tx.insert(s.orderItems).values(
      lines.map((l) => {
        const p = priced.get(l.id)!;
        return {
          id: id('oi'),
          orderId,
          productId: l.productId,
          variantId: l.variantId,
          kind: l.kind,
          sku: l.sku,
          title: l.title,
          variantTitle: l.variantTitle,
          quantity: l.quantity,
          unitPrice: p.unitPrice,
          discount: p.discount,
          total: p.total,
          taxRate: p.taxRate,
          taxAmount: p.taxAmount,
          sellerId: l.sellerId,
          slotId: l.slot?.id ?? null,
          meta: l.slot ? { slot: l.slot } : {},
        };
      }),
    );

    if (pricing.coupon?.applied) await tx.update(s.coupons).set({ usedCount: sql`${s.coupons.usedCount} + 1` }).where(eq(s.coupons.code, pricing.coupon.code));
    await tx.update(s.carts).set({ status: 'converted', updatedAt: new Date() }).where(eq(s.carts.id, cart.id));
    await emit(tx, { type: 'order.placed', payload: { orderId } });
    return { orderId, number, total: pricing.total, currency: cart.currency, locale: cart.locale };
  });

  // free orders (100 % coupon) need no payment
  if (result.total === 0) {
    await markOrderPaid(ctx, result.orderId, { provider: 'free', providerRef: 'free', amount: 0 });
    return { ...result, accessToken, payment: { type: 'none' } };
  }

  const { action, providerRef } = await provider.createPayment({ id: result.orderId, number: result.number, total: result.total, currency: result.currency, email: input.email, locale: result.locale, accessToken });
  if (providerRef) await ctx.db.update(s.orders).set({ paymentRef: providerRef }).where(eq(s.orders.id, result.orderId));
  return { orderId: result.orderId, number: result.number, accessToken, total: result.total, currency: result.currency, payment: action };
}

/** Release reservations of orders that were never paid (e.g. abandoned redirects). */
export async function expireUnpaidOrders(ctx: AppContext, olderThanHours = 48, providers = ['mock', 'stripe']) {
  const cutoff = new Date(ctx.now().getTime() - olderThanHours * 3600_000);
  const stale = await ctx.db.select({ id: s.orders.id, provider: s.orders.paymentProvider }).from(s.orders).where(and(eq(s.orders.status, 'pending_payment'), lte(s.orders.placedAt, cutoff)));
  const { cancelOrder } = await import('../orders/orders.service.js');
  let n = 0;
  for (const o of stale) {
    if (!providers.includes(o.provider)) continue; // prepayment orders wait for the bank transfer
    await cancelOrder(ctx, o.id, 'payment_timeout');
    n++;
  }
  return n;
}
