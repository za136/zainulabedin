import { and, desc, eq, sql } from 'drizzle-orm';
import { canTransition, deriveFulfillmentStatus, formatMoney, id, t, type Currency, type FulfillmentStatus, type Locale, type OrderStatus } from '@factory/core';
import { schema as s, type Database } from '@factory/db';
import type { AppContext } from '../../context.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { safeEqual, sha256 } from '../../lib/security.js';
import { fulfillOrder } from '../fulfillment/fulfillment.service.js';
import { emit } from '../notifications/outbox.js';

type Order = typeof s.orders.$inferSelect;

/**
 * The single entry point for "money has arrived". Idempotent: webhooks may be
 * delivered more than once. Converts stock reservations into deductions and runs
 * fulfillment (entitlements, licence keys, subscriptions, bookings).
 */
export async function markOrderPaid(ctx: AppContext, orderId: string, payment: { provider: string; providerRef?: string; amount: number; raw?: unknown }): Promise<Order> {
  return ctx.db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Database;
    const locked = await tx.execute(sql`select id from orders where id = ${orderId} for update`);
    if (locked.rows.length === 0) throw notFound('order');
    const order = (await tx.query.orders.findFirst({ where: eq(s.orders.id, orderId) }))!;
    if (order.paymentStatus === 'paid') return order; // idempotent
    if (!canTransition(order.status, 'paid')) throw conflict('invalid_state', `Order is ${order.status}`);
    if (payment.amount !== order.totals.total) throw new AppError(422, 'amount_mismatch', `Expected ${order.totals.total}, got ${payment.amount}`);

    const paidAt = ctx.now();
    await tx.insert(s.payments).values({ id: id('pay'), orderId, provider: payment.provider, providerRef: payment.providerRef ?? null, amount: payment.amount, currency: order.currency, status: 'succeeded', raw: payment.raw ?? null });

    // reservation → deduction
    const items = await tx.select().from(s.orderItems).where(eq(s.orderItems.orderId, orderId));
    for (const item of items) {
      await tx
        .update(s.variants)
        .set({ stockOnHand: sql`case when ${s.variants.stockOnHand} is null then null else ${s.variants.stockOnHand} - ${item.quantity} end`, stockReserved: sql`greatest(${s.variants.stockReserved} - ${item.quantity}, 0)` })
        .where(eq(s.variants.id, item.variantId));
    }

    const paidOrder = { ...order, paymentStatus: 'paid' as const, paidAt };
    const statuses = await fulfillOrder(ctx, tx, paidOrder, paidAt);
    const status = deriveFulfillmentStatus(statuses.map((x) => (x === 'scheduled' ? 'unfulfilled' : x)));
    const finalStatus: OrderStatus = status === 'cancelled' ? 'paid' : status;
    const [updated] = await tx
      .update(s.orders)
      .set({ paymentStatus: 'paid', paidAt, status: finalStatus, paymentRef: payment.providerRef ?? order.paymentRef, updatedAt: paidAt })
      .where(eq(s.orders.id, orderId))
      .returning();
    await emit(tx, { type: 'order.paid', payload: { orderId } });
    return updated!;
  });
}

export async function markPaymentFailed(ctx: AppContext, orderId: string) {
  await ctx.db.update(s.orders).set({ paymentStatus: 'failed', updatedAt: new Date() }).where(and(eq(s.orders.id, orderId), eq(s.orders.status, 'pending_payment')));
}

/** Cancel an unpaid order and release reserved stock and appointment slots. */
export async function cancelOrder(ctx: AppContext, orderId: string, reason: string) {
  return ctx.db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Database;
    await tx.execute(sql`select id from orders where id = ${orderId} for update`);
    const order = await tx.query.orders.findFirst({ where: eq(s.orders.id, orderId) });
    if (!order) throw notFound('order');
    if (order.status === 'cancelled') return order;
    if (order.status !== 'pending_payment') throw conflict('invalid_state', 'Paid orders must be refunded, not cancelled');
    const items = await tx.select().from(s.orderItems).where(eq(s.orderItems.orderId, orderId));
    for (const item of items) {
      await tx.update(s.variants).set({ stockReserved: sql`greatest(${s.variants.stockReserved} - ${item.quantity}, 0)` }).where(eq(s.variants.id, item.variantId));
      if (item.slotId) await tx.update(s.serviceSlots).set({ booked: sql`greatest(${s.serviceSlots.booked} - ${item.quantity}, 0)` }).where(eq(s.serviceSlots.id, item.slotId));
      await tx.update(s.orderItems).set({ fulfillmentStatus: 'cancelled' }).where(eq(s.orderItems.id, item.id));
    }
    const [updated] = await tx
      .update(s.orders)
      .set({ status: 'cancelled', cancelledAt: ctx.now(), updatedAt: ctx.now(), totals: { ...order.totals, invoiceNotes: [...order.totals.invoiceNotes, `cancelled: ${reason}`] } })
      .where(eq(s.orders.id, orderId))
      .returning();
    await emit(tx, { type: 'order.cancelled', payload: { orderId } });
    return updated!;
  });
}

export async function shipItem(ctx: AppContext, orderId: string, itemId: string, trackingNumber?: string) {
  return ctx.db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Database;
    const order = await tx.query.orders.findFirst({ where: eq(s.orders.id, orderId) });
    if (!order) throw notFound('order');
    if (order.paymentStatus !== 'paid') throw conflict('not_paid', 'Order is not paid yet');
    const item = await tx.query.orderItems.findFirst({ where: and(eq(s.orderItems.id, itemId), eq(s.orderItems.orderId, orderId)) });
    if (!item) throw notFound('order item');
    if (item.kind !== 'physical' && item.kind !== 'book') throw badRequest('not_shippable');
    await tx.update(s.orderItems).set({ fulfillmentStatus: 'fulfilled', trackingNumber: trackingNumber ?? null }).where(eq(s.orderItems.id, itemId));
    const all = await tx.select({ st: s.orderItems.fulfillmentStatus }).from(s.orderItems).where(eq(s.orderItems.orderId, orderId));
    const next = deriveFulfillmentStatus(all.map((x) => (x.st === 'scheduled' ? 'fulfilled' : x.st) as FulfillmentStatus));
    if (next !== order.status && canTransition(order.status, next)) await tx.update(s.orders).set({ status: next, updatedAt: ctx.now() }).where(eq(s.orders.id, orderId));
    await emit(tx, { type: 'order.item_shipped', payload: { orderId, itemId, trackingNumber } });
    return orderView(ctx, orderId, tx);
  });
}

export async function orderView(ctx: AppContext, orderId: string, db: Database = ctx.db) {
  const order = await db.query.orders.findFirst({ where: eq(s.orders.id, orderId) });
  if (!order) throw notFound('order');
  const items = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, orderId));
  const { accessTokenHash: _omit, ...rest } = order;
  return { ...rest, items };
}
export type OrderView = Awaited<ReturnType<typeof orderView>>;

/** Authorize access to an order: owner, admin, or guest holding the order access token. */
export async function authorizeOrder(ctx: AppContext, orderId: string, who: { customerId?: string; role?: string; token?: string }) {
  const order = await ctx.db.query.orders.findFirst({ where: eq(s.orders.id, orderId) });
  if (!order) throw notFound('order');
  if (who.role === 'admin') return order;
  if (who.customerId && order.customerId === who.customerId) return order;
  if (who.token && order.accessTokenHash && safeEqual(sha256(who.token), order.accessTokenHash)) return order;
  throw forbidden();
}

export async function listCustomerOrders(ctx: AppContext, customerId: string) {
  const rows = await ctx.db.select().from(s.orders).where(eq(s.orders.customerId, customerId)).orderBy(desc(s.orders.placedAt)).limit(100);
  return rows.map(({ accessTokenHash: _omit, ...o }) => o);
}

/** Printable German invoice (Rechnung) with all § 14 Abs. 4 UStG fields. */
export async function invoiceHtml(ctx: AppContext, orderId: string): Promise<string> {
  const o = await orderView(ctx, orderId);
  if (o.paymentStatus !== 'paid') throw conflict('not_paid', 'Invoices are issued after payment');
  const cfg = ctx.store.config;
  const L = o.locale as Locale;
  const de = L !== 'en';
  const fmt = (n: number) => formatMoney({ amount: n, currency: o.currency as Currency }, de ? 'de-DE' : 'en-GB');
  const esc = (x: unknown) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const pct = (bps: number) => `${(bps / 100).toLocaleString(de ? 'de-DE' : 'en-GB')} %`;
  const b = o.billingAddress;
  const date = (o.paidAt ?? o.placedAt).toLocaleDateString(de ? 'de-DE' : 'en-GB');
  const rows = o.items
    .map((i) => `<tr><td>${i.quantity}</td><td>${esc(i.title)}${i.variantTitle ? ` <small>(${esc(i.variantTitle)})</small>` : ''}<br><small>${esc(i.sku)}</small></td><td>${pct(i.taxRate)}</td><td class=r>${fmt(i.unitPrice)}</td><td class=r>${i.discount ? '−' + fmt(i.discount) : ''}</td><td class=r>${fmt(i.total)}</td></tr>`)
    .join('');
  const taxRows = o.totals.taxLines.map((tl) => `<tr><td colspan=5 class=r>${de ? 'Netto' : 'Net'} ${pct(tl.rate)}${tl.country ? ` (${tl.country})` : ''}: ${fmt(tl.net)} · ${de ? 'USt.' : 'VAT'} ${pct(tl.rate)}</td><td class=r>${fmt(tl.tax)}</td></tr>`).join('');
  return `<!doctype html><html lang="${L}"><head><meta charset="utf-8"><title>${de ? 'Rechnung' : 'Invoice'} ${esc(o.number)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;max-width:800px;margin:40px auto;color:#111}table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #ddd;text-align:left}.r{text-align:right}header{display:flex;justify-content:space-between}small{color:#666}@media print{body{margin:0}}</style></head><body>
<header><div><strong>${esc(cfg.legal.company)}</strong><br>${esc(cfg.legal.street)}<br>${esc(cfg.legal.zip)} ${esc(cfg.legal.city)}<br>${esc(cfg.legal.email)}</div>
<div class=r>${de ? 'USt-IdNr.' : 'VAT ID'}: ${esc(cfg.legal.vatId ?? '—')}<br>${cfg.legal.registerCourt ? esc(cfg.legal.registerCourt + ' ' + (cfg.legal.registerNumber ?? '')) : ''}</div></header>
<p>${esc(b.company ?? '')}${b.company ? '<br>' : ''}${esc(b.firstName)} ${esc(b.lastName)}<br>${esc(b.street)}<br>${esc(b.zip)} ${esc(b.city)}<br>${esc(b.country)}${o.vatId ? `<br>${de ? 'USt-IdNr.' : 'VAT ID'}: ${esc(o.vatId)}` : ''}</p>
<h1>${de ? 'Rechnung' : 'Invoice'} ${esc(o.number)}</h1>
<p>${de ? 'Rechnungsdatum = Leistungsdatum' : 'Invoice date = date of supply'}: ${date}</p>
<table><thead><tr><th>${de ? 'Menge' : 'Qty'}</th><th>${de ? 'Artikel' : 'Item'}</th><th>${de ? 'USt.' : 'VAT'}</th><th class=r>${de ? 'Einzelpreis' : 'Unit'}</th><th class=r>${de ? 'Rabatt' : 'Discount'}</th><th class=r>${de ? 'Gesamt' : 'Total'}</th></tr></thead><tbody>${rows}
${o.totals.shipping ? `<tr><td></td><td>${de ? 'Versand' : 'Shipping'}${o.totals.shippingRate ? ' – ' + esc(t(o.totals.shippingRate.name, L)) : ''}</td><td></td><td></td><td></td><td class=r>${fmt(o.totals.shipping)}</td></tr>` : ''}
${taxRows}<tr><th colspan=5 class=r>${de ? 'Gesamtbetrag' : 'Total amount'}</th><th class=r>${fmt(o.totals.total)}</th></tr></tbody></table>
${o.totals.invoiceNotes.filter((n) => !n.startsWith('cancelled')).map((n) => `<p><em>${esc(n)}</em></p>`).join('')}
<p><small>${de ? 'Bezahlt' : 'Paid'} via ${esc(o.paymentProvider)}. ${esc(cfg.name)} · ${esc(cfg.url)}</small></p></body></html>`;
}
