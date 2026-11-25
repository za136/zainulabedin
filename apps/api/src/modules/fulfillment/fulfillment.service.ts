import { eq } from 'drizzle-orm';
import { addInterval, digitalAccessStartsAt, id, kindDef, licenseKey, parseAttributes, type FulfillmentStatus, type FulfillmentStrategy } from '@factory/core';
import { schema as s, type Database, type EntitlementType } from '@factory/db';
import type { AppContext } from '../../context.js';

type Order = typeof s.orders.$inferSelect;
type OrderItem = typeof s.orderItems.$inferSelect;
type Product = typeof s.products.$inferSelect;
type Variant = typeof s.variants.$inferSelect;

interface HandlerArgs {
  ctx: AppContext;
  tx: Database;
  order: Order;
  item: OrderItem;
  product: Product;
  variant: Variant | undefined;
  paidAt: Date;
}

/**
 * FULFILLMENT HANDLERS — one per strategy of the product-kind registry.
 * Each returns the new fulfillment status of the order item.
 * Add a handler here when you add a new FulfillmentStrategy in @factory/core.
 */
const handlers: Record<FulfillmentStrategy, (a: HandlerArgs) => Promise<FulfillmentStatus>> = {
  // physical goods wait for the warehouse (admin "ship" action or a WMS webhook)
  shipment: async () => 'unfulfilled',

  download: async (a) => {
    const attrs = parseAttributes('digital_download', a.product.attributes);
    return grant(a, 'download', { maxDownloads: attrs.maxDownloads ?? null });
  },

  entitlement: async (a) => {
    const type: EntitlementType = a.product.kind === 'ebook' ? 'ebook' : a.product.kind === 'interactive_book' ? 'interactive_book' : 'course';
    const data: Record<string, unknown> = {};
    if (type === 'ebook') {
      const name = `${a.order.billingAddress.firstName} ${a.order.billingAddress.lastName}`;
      data.watermark = `Lizenziert für ${name} <${a.order.email}> · ${a.order.number}`;
    }
    return grant(a, type, data);
  },

  license_key: async (a) => {
    const attrs = parseAttributes('license', a.product.attributes);
    const keys = Array.from({ length: a.item.quantity }, () => licenseKey(attrs.keyPrefix));
    const expiresAt = attrs.durationDays ? new Date(a.paidAt.getTime() + attrs.durationDays * 86_400_000) : null;
    return grant(a, 'license', { keys, seats: attrs.seats, platforms: attrs.platforms }, expiresAt);
  },

  subscription: async (a) => {
    const billing = a.variant?.billing ?? { interval: 'month' as const, intervalCount: 1, trialDays: 0 };
    const attrs = parseAttributes('subscription', a.product.attributes);
    const subId = id('sub');
    const periodEnd = addInterval(a.paidAt, billing);
    await a.tx.insert(s.subscriptions).values({
      id: subId,
      customerId: a.order.customerId,
      email: a.order.email,
      productId: a.product.id,
      variantId: a.item.variantId,
      orderId: a.order.id,
      status: 'active',
      amount: a.item.total,
      currency: a.order.currency,
      billing,
      currentPeriodStart: a.paidAt,
      currentPeriodEnd: periodEnd,
      providerRef: a.order.paymentRef,
    });
    return grant(a, 'subscription', { grantsAccessTo: attrs.grantsAccessTo }, periodEnd, subId);
  },

  booking: async (a) => {
    if (a.item.slotId) {
      await a.tx.insert(s.bookings).values({ id: id('bkg'), orderItemId: a.item.id, slotId: a.item.slotId, customerId: a.order.customerId, email: a.order.email });
    }
    return 'scheduled';
  },
};

async function grant(a: HandlerArgs, type: EntitlementType, data: Record<string, unknown>, expiresAt: Date | null = null, subscriptionId?: string): Promise<FulfillmentStatus> {
  // § 356 Abs. 5 BGB: without the waiver, digital content is provided after the withdrawal period
  const startsAt = digitalAccessStartsAt(a.paidAt, !!a.order.consents.digital_waiver);
  await a.tx.insert(s.entitlements).values({
    id: id('ent'),
    customerId: a.order.customerId,
    email: a.order.email,
    productId: a.product.id,
    orderItemId: a.item.id,
    subscriptionId: subscriptionId ?? null,
    type,
    startsAt,
    expiresAt,
    data,
  });
  return startsAt <= a.paidAt ? 'fulfilled' : 'scheduled';
}

export async function fulfillOrder(ctx: AppContext, tx: Database, order: Order, paidAt: Date): Promise<FulfillmentStatus[]> {
  const items = await tx.select().from(s.orderItems).where(eq(s.orderItems.orderId, order.id));
  const statuses: FulfillmentStatus[] = [];
  for (const item of items) {
    const product = await tx.query.products.findFirst({ where: eq(s.products.id, item.productId) });
    if (!product) continue;
    const variant = await tx.query.variants.findFirst({ where: eq(s.variants.id, item.variantId) });
    const strategy = kindDef(item.kind).fulfillment;
    const status = await handlers[strategy]({ ctx, tx, order, item, product, variant, paidAt });
    await tx.update(s.orderItems).set({ fulfillmentStatus: status }).where(eq(s.orderItems.id, item.id));
    statuses.push(status);
  }
  return statuses;
}
