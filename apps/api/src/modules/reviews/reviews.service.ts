import { and, desc, eq, sql } from 'drizzle-orm';
import { id } from '@factory/core';
import { schema as s } from '@factory/db';
import type { AppContext } from '../../context.js';
import { conflict, notFound } from '../../lib/errors.js';
import type { AuthUser } from '../../plugins/auth.js';

/**
 * Reviews. Verified-purchase reviews are published immediately; others wait for
 * moderation. Per § 5b Abs. 3 UWG the shop must disclose how it verifies reviews —
 * the storefront shows the "verified purchase" badge and explains the process.
 */
export async function listReviews(ctx: AppContext, slug: string) {
  const product = await ctx.db.query.products.findFirst({ where: eq(s.products.slug, slug) });
  if (!product) throw notFound('product');
  const rows = await ctx.db
    .select({ id: s.reviews.id, authorName: s.reviews.authorName, rating: s.reviews.rating, title: s.reviews.title, body: s.reviews.body, locale: s.reviews.locale, verifiedPurchase: s.reviews.verifiedPurchase, createdAt: s.reviews.createdAt })
    .from(s.reviews)
    .where(and(eq(s.reviews.productId, product.id), eq(s.reviews.status, 'published')))
    .orderBy(desc(s.reviews.createdAt))
    .limit(50);
  return { reviews: rows, summary: product.ratingCount ? { avg: (product.ratingAvg ?? 0) / 100, count: product.ratingCount } : null };
}

export async function createReview(ctx: AppContext, user: AuthUser, slug: string, input: { rating: number; title?: string; body?: string; locale?: string }) {
  const product = await ctx.db.query.products.findFirst({ where: eq(s.products.slug, slug) });
  if (!product) throw notFound('product');
  const dup = await ctx.db.query.reviews.findFirst({ where: and(eq(s.reviews.productId, product.id), eq(s.reviews.customerId, user.id)) });
  if (dup) throw conflict('already_reviewed');
  const bought = await ctx.db.execute(sql`select 1 from order_items oi join orders o on o.id = oi.order_id
    where oi.product_id = ${product.id} and o.customer_id = ${user.id} and o.payment_status = 'paid' limit 1`);
  const verified = bought.rows.length > 0;
  const status = verified ? 'published' : 'pending';
  await ctx.db.insert(s.reviews).values({
    id: id('rev'),
    productId: product.id,
    customerId: user.id,
    authorName: user.firstName ? `${user.firstName} ${(user.lastName ?? '').slice(0, 1)}.`.trim() : 'Kunde',
    rating: input.rating,
    title: input.title ?? null,
    body: input.body ?? null,
    locale: input.locale ?? user.locale,
    verifiedPurchase: verified,
    status,
  });
  if (status === 'published') await refreshRating(ctx, product.id);
  return { status, verifiedPurchase: verified };
}

export async function refreshRating(ctx: AppContext, productId: string) {
  await ctx.db.execute(sql`update products set
    rating_avg_x100 = (select round(avg(rating) * 100)::int from reviews where product_id = ${productId} and status = 'published'),
    rating_count = (select count(*)::int from reviews where product_id = ${productId} and status = 'published')
    where id = ${productId}`);
}
