import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { ORDER_STATUSES } from '@factory/core';
import { schema as s, seedStore } from '@factory/db';
import { loadStore } from '@factory/config';
import type { AppContext } from '../../context.js';
import { notFound } from '../../lib/errors.js';
import { requireAdmin } from '../../plugins/auth.js';
import { cancelOrder, markOrderPaid, orderView, shipItem } from '../orders/orders.service.js';
import { refreshRating } from '../reviews/reviews.service.js';

/** Back-office API. Every route requires role=admin. */
export async function registerAdminRoutes(app: FastifyInstance, ctx: AppContext) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.addHook('onRequest', async (req) => {
    if (req.url.startsWith('/v1/admin')) requireAdmin(req);
  });

  r.get('/v1/admin/stats', { schema: { tags: ['admin'], summary: 'Dashboard KPIs' } }, async () => {
    const [revenue, byStatus, lowStock, top, pendingReviews] = await Promise.all([
      ctx.db.execute(sql`select currency, sum((totals->>'total')::int)::int as total, count(*)::int as orders from orders where payment_status = 'paid' group by currency`),
      ctx.db.execute(sql`select status, count(*)::int as n from orders group by status`),
      ctx.db.execute(sql`select v.sku, v.stock_on_hand - v.stock_reserved as available, p.slug from variants v join products p on p.id = v.product_id
        where v.stock_on_hand is not null and v.stock_on_hand - v.stock_reserved <= ${ctx.store.config.catalog.lowStockThreshold} order by available asc limit 20`),
      ctx.db.execute(sql`select oi.title, sum(oi.quantity)::int as units, sum(oi.total)::int as revenue from order_items oi join orders o on o.id = oi.order_id
        where o.payment_status = 'paid' group by oi.title order by revenue desc limit 10`),
      ctx.db.execute(sql`select count(*)::int as n from reviews where status = 'pending'`),
    ]);
    return { revenue: revenue.rows, ordersByStatus: byStatus.rows, lowStock: lowStock.rows, topProducts: top.rows, pendingReviews: (pendingReviews.rows[0] as { n: number }).n };
  });

  r.get('/v1/admin/orders', { schema: { tags: ['admin'], querystring: z.object({ status: z.enum(ORDER_STATUSES).optional(), limit: z.coerce.number().int().max(200).default(50) }) } }, async (req) => {
    const rows = await ctx.db.select().from(s.orders).where(req.query.status ? eq(s.orders.status, req.query.status) : undefined).orderBy(desc(s.orders.placedAt)).limit(req.query.limit);
    return { orders: rows.map(({ accessTokenHash: _x, ...o }) => o) };
  });
  r.get('/v1/admin/orders/:id', { schema: { tags: ['admin'], params: z.object({ id: z.string() }) } }, async (req) => orderView(ctx, req.params.id));
  r.post('/v1/admin/orders/:id/mark-paid', { schema: { tags: ['admin'], summary: 'Confirm bank transfer (Vorkasse)', params: z.object({ id: z.string() }) } }, async (req) => {
    const o = await ctx.db.query.orders.findFirst({ where: eq(s.orders.id, req.params.id) });
    if (!o) throw notFound('order');
    await markOrderPaid(ctx, o.id, { provider: o.paymentProvider, providerRef: o.paymentRef ?? undefined, amount: o.totals.total });
    return orderView(ctx, o.id);
  });
  r.post('/v1/admin/orders/:id/cancel', { schema: { tags: ['admin'], params: z.object({ id: z.string() }), body: z.object({ reason: z.string().default('admin') }).optional() } }, async (req) => {
    await cancelOrder(ctx, req.params.id, req.body?.reason ?? 'admin');
    return orderView(ctx, req.params.id);
  });
  r.post('/v1/admin/orders/:id/items/:itemId/ship', { schema: { tags: ['admin'], params: z.object({ id: z.string(), itemId: z.string() }), body: z.object({ trackingNumber: z.string().optional() }).optional() } }, async (req) => shipItem(ctx, req.params.id, req.params.itemId, req.body?.trackingNumber));

  r.get('/v1/admin/products', { schema: { tags: ['admin'] } }, async () => {
    const rows = await ctx.db.execute(sql`select p.id, p.slug, p.kind, p.status, p.featured, p.price_bound, t.title,
      (select json_agg(json_build_object('id', v.id, 'sku', v.sku, 'stockOnHand', v.stock_on_hand, 'reserved', v.stock_reserved)) from variants v where v.product_id = p.id) as variants
      from products p left join product_translations t on t.product_id = p.id and t.locale = ${ctx.store.config.locales.default} order by p.created_at desc`);
    return { products: rows.rows };
  });
  r.patch('/v1/admin/products/:id', { schema: { tags: ['admin'], params: z.object({ id: z.string() }), body: z.object({ status: z.enum(['draft', 'active', 'archived']).optional(), featured: z.boolean().optional() }) } }, async (req) => {
    const [p] = await ctx.db.update(s.products).set({ ...req.body, updatedAt: new Date() }).where(eq(s.products.id, req.params.id)).returning();
    if (!p) throw notFound('product');
    return p;
  });
  r.patch(
    '/v1/admin/variants/:id',
    { schema: { tags: ['admin'], params: z.object({ id: z.string() }), body: z.object({ stockOnHand: z.number().int().min(0).nullable().optional(), prices: z.record(z.string(), z.number().int().nonnegative()).optional() }) } },
    async (req) => {
      const v = await ctx.db.query.variants.findFirst({ where: eq(s.variants.id, req.params.id) });
      if (!v) throw notFound('variant');
      if (req.body.stockOnHand !== undefined) await ctx.db.update(s.variants).set({ stockOnHand: req.body.stockOnHand }).where(eq(s.variants.id, v.id));
      for (const [currency, amount] of Object.entries(req.body.prices ?? {}))
        await ctx.db.insert(s.prices).values({ variantId: v.id, currency, amount }).onConflictDoUpdate({ target: [s.prices.variantId, s.prices.currency], set: { amount } });
      return { ok: true };
    },
  );

  r.get('/v1/admin/reviews', { schema: { tags: ['admin'] } }, async () => ({ reviews: await ctx.db.select().from(s.reviews).where(eq(s.reviews.status, 'pending')).orderBy(desc(s.reviews.createdAt)) }));
  r.post('/v1/admin/reviews/:id/:decision', { schema: { tags: ['admin'], params: z.object({ id: z.string(), decision: z.enum(['publish', 'reject']) }) } }, async (req) => {
    const [rev] = await ctx.db.update(s.reviews).set({ status: req.params.decision === 'publish' ? 'published' : 'rejected' }).where(eq(s.reviews.id, req.params.id)).returning();
    if (!rev) throw notFound('review');
    await refreshRating(ctx, rev.productId);
    return rev;
  });

  r.get('/v1/admin/marketplace/payouts', { schema: { tags: ['admin'], summary: 'Seller revenue minus commission (paid orders)' } }, async () => {
    const rows = await ctx.db.execute(sql`select se.slug, se.name, se.commission_bps, o.currency, sum(oi.total)::int as gross,
      round(sum(oi.total) * se.commission_bps / 10000.0)::int as commission
      from order_items oi join orders o on o.id = oi.order_id and o.payment_status = 'paid' join sellers se on se.id = oi.seller_id
      group by se.slug, se.name, se.commission_bps, o.currency`);
    return { payouts: (rows.rows as { gross: number; commission: number }[]).map((x) => ({ ...x, payout: x.gross - x.commission })) };
  });

  r.post('/v1/admin/reseed', { schema: { tags: ['admin'], summary: 'Re-sync catalog from the store folder (store.json + catalog/*.json)' } }, async () => {
    const store = loadStore(ctx.store.dir);
    Object.assign(ctx.store, store);
    return seedStore(ctx.db, store);
  });

}
