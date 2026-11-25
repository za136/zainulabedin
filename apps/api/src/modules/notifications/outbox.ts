import { and, asc, eq, isNull, lt } from 'drizzle-orm';
import { formatMoney, id, t, type Currency, type Locale } from '@factory/core';
import { schema as s, type Database } from '@factory/db';
import type { AppContext } from '../../context.js';

export type DomainEvent =
  | { type: 'order.placed'; payload: { orderId: string } }
  | { type: 'order.paid'; payload: { orderId: string } }
  | { type: 'order.cancelled'; payload: { orderId: string } }
  | { type: 'order.item_shipped'; payload: { orderId: string; itemId: string; trackingNumber?: string } }
  | { type: 'subscription.cancelled'; payload: { subscriptionId: string } }
  | { type: 'customer.registered'; payload: { customerId: string } };

/** Write an event in the caller's transaction (transactional outbox pattern). */
export async function emit(db: Database, event: DomainEvent): Promise<void> {
  await db.insert(s.outboxEvents).values({ id: id('evt'), type: event.type, payload: event.payload });
}

/**
 * Deliver pending events. Runs on an interval in the API process; can also be moved
 * to a separate worker — it is safe to run concurrently thanks to processed_at checks.
 * Extend `handle()` to push webhooks, update a search index, send analytics, …
 */
export async function processOutbox(ctx: AppContext, limit = 50): Promise<number> {
  const events = await ctx.db
    .select()
    .from(s.outboxEvents)
    .where(and(isNull(s.outboxEvents.processedAt), lt(s.outboxEvents.attempts, 5)))
    .orderBy(asc(s.outboxEvents.createdAt))
    .limit(limit);
  for (const evt of events) {
    try {
      await handle(ctx, evt as unknown as DomainEvent);
      await ctx.db.update(s.outboxEvents).set({ processedAt: new Date(), attempts: evt.attempts + 1 }).where(eq(s.outboxEvents.id, evt.id));
    } catch (e) {
      await ctx.db.update(s.outboxEvents).set({ attempts: evt.attempts + 1, lastError: String((e as Error).message) }).where(eq(s.outboxEvents.id, evt.id));
    }
  }
  return events.length;
}

async function handle(ctx: AppContext, evt: DomainEvent) {
  const cfg = ctx.store.config;
  if (evt.type === 'order.placed' || evt.type === 'order.paid' || evt.type === 'order.item_shipped' || evt.type === 'order.cancelled') {
    const order = await ctx.db.query.orders.findFirst({ where: eq(s.orders.id, evt.payload.orderId) });
    if (!order) return;
    const items = await ctx.db.select().from(s.orderItems).where(eq(s.orderItems.orderId, order.id));
    const L = order.locale as Locale;
    const de = L === 'de';
    const fmt = (n: number) => formatMoney({ amount: n, currency: order.currency as Currency }, de ? 'de-DE' : 'en-GB');
    const lines = items.map((i) => `  ${i.quantity} × ${i.title}${i.variantTitle ? ` (${i.variantTitle})` : ''} — ${fmt(i.total)}`).join('\n');
    const link = `${ctx.env.WEB_URL}${de ? '' : '/' + L}/account/orders/${order.id}`;
    const subject = {
      'order.placed': de ? `Deine Bestellung ${order.number} bei ${cfg.name}` : `Your order ${order.number} at ${cfg.name}`,
      'order.paid': de ? `Zahlung erhalten – ${order.number}` : `Payment received — ${order.number}`,
      'order.item_shipped': de ? `Deine Bestellung ${order.number} ist unterwegs` : `Your order ${order.number} has shipped`,
      'order.cancelled': de ? `Bestellung ${order.number} storniert` : `Order ${order.number} cancelled`,
    }[evt.type];
    const legal = de
      ? `\nWiderrufsbelehrung & AGB: ${ctx.env.WEB_URL}/legal/widerruf · ${ctx.env.WEB_URL}/legal/agb\n${cfg.legal.company}, ${cfg.legal.street}, ${cfg.legal.zip} ${cfg.legal.city}`
      : `\nCancellation policy & terms: ${ctx.env.WEB_URL}/en/legal/withdrawal · ${ctx.env.WEB_URL}/en/legal/terms\n${cfg.legal.company}, ${cfg.legal.street}, ${cfg.legal.zip} ${cfg.legal.city}`;
    const tracking = evt.type === 'order.item_shipped' && evt.payload.trackingNumber ? `\nSendungsnummer / tracking: ${evt.payload.trackingNumber}\n` : '';
    await ctx.mailer.send({
      to: order.email,
      subject,
      text: `${t(cfg.tagline, L)}\n\n${lines}\n\n${de ? 'Gesamt' : 'Total'}: ${fmt(order.totals.total)}\n${tracking}\n${link}\n${legal}`,
    });
  }
}

export async function pendingEvents(db: Database) {
  return db.select().from(s.outboxEvents).where(isNull(s.outboxEvents.processedAt));
}
