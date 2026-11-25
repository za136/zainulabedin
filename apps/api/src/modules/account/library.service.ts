import { createReadStream, existsSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { parseAttributes, type DiagramScene } from '@factory/core';
import { schema as s } from '@factory/db';
import type { AppContext, Market } from '../../context.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { signToken, verifyToken } from '../../lib/security.js';
import { hydrateProducts } from '../catalog/catalog.service.js';
import { emit } from '../notifications/outbox.js';

type Entitlement = typeof s.entitlements.$inferSelect;

function ownerFilter(customerId: string) {
  return eq(s.entitlements.customerId, customerId);
}

function isUsable(e: Entitlement, now: Date) {
  return e.status === 'active' && e.startsAt <= now && (!e.expiresAt || e.expiresAt > now);
}

/** Does the customer have access to a product (directly or through a subscription)? */
export async function hasAccess(ctx: AppContext, customerId: string, productId: string): Promise<boolean> {
  const now = ctx.now();
  const product = await ctx.db.query.products.findFirst({ where: eq(s.products.id, productId) });
  if (!product) return false;
  const ents = await ctx.db.select().from(s.entitlements).where(ownerFilter(customerId));
  return ents.some(
    (e) => isUsable(e, now) && (e.productId === productId || (e.type === 'subscription' && ((e.data.grantsAccessTo as string[] | undefined) ?? []).includes(product.slug))),
  );
}

/** Attach guest purchases to an account (called after login with a valid order access token). */
export async function claimGuestOrder(ctx: AppContext, customerId: string, orderId: string) {
  await ctx.db.transaction(async (tx) => {
    await tx.update(s.orders).set({ customerId }).where(and(eq(s.orders.id, orderId), isNull(s.orders.customerId)));
    const items = await tx.select({ id: s.orderItems.id }).from(s.orderItems).where(eq(s.orderItems.orderId, orderId));
    if (items.length) await tx.update(s.entitlements).set({ customerId }).where(and(inArray(s.entitlements.orderItemId, items.map((i) => i.id)), isNull(s.entitlements.customerId)));
    await tx.update(s.subscriptions).set({ customerId }).where(and(eq(s.subscriptions.orderId, orderId), isNull(s.subscriptions.customerId)));
  });
}

export async function library(ctx: AppContext, customerId: string, market: Market) {
  const now = ctx.now();
  const ents = await ctx.db.select().from(s.entitlements).where(ownerFilter(customerId)).orderBy(desc(s.entitlements.createdAt));
  const productIds = [...new Set(ents.map((e) => e.productId))];
  // subscriptions unlock further products
  const unlockedSlugs = ents.filter((e) => e.type === 'subscription' && isUsable(e, now)).flatMap((e) => (e.data.grantsAccessTo as string[]) ?? []);
  const unlocked = unlockedSlugs.length ? await ctx.db.select({ id: s.products.id, slug: s.products.slug }).from(s.products).where(inArray(s.products.slug, unlockedSlugs)) : [];
  const hydrated = await hydrateProducts(ctx, [...new Set([...productIds, ...unlocked.map((u) => u.id)])], market);
  const progress = ents.length
    ? await ctx.db.select().from(s.courseProgress).where(inArray(s.courseProgress.entitlementId, ents.map((e) => e.id)))
    : [];

  const items = ents.map((e) => {
    const h = hydrated.get(e.productId);
    const attrs = h?.row.attributes ?? {};
    const files = ((attrs.files as { key: string; name: string; format?: string }[] | undefined) ?? []).map((f) => ({
      ...f,
      url: isUsable(e, now) ? `${ctx.env.API_URL}/v1/downloads/${signToken({ e: e.id, f: f.key, exp: Math.floor(now.getTime() / 1000) + 3600 }, ctx.env.APP_SECRET)}` : null,
    }));
    const lessonsDone = progress.filter((p) => p.entitlementId === e.id).map((p) => p.lessonId);
    const totalLessons = h?.row.kind === 'course' ? parseAttributes('course', attrs).modules.reduce((n, m) => n + m.lessons.length, 0) : 0;
    return {
      id: e.id,
      type: e.type,
      status: e.status,
      available: isUsable(e, now),
      startsAt: e.startsAt.toISOString(),
      expiresAt: e.expiresAt?.toISOString() ?? null,
      product: h?.card ?? null,
      files,
      licenseKeys: (e.data.keys as string[] | undefined) ?? [],
      diagrams: (attrs.diagrams as string[] | undefined) ?? [],
      watermark: (e.data.watermark as string | undefined) ?? null,
      course: h?.row.kind === 'course' ? { modules: parseAttributes('course', attrs).modules, completed: lessonsDone, progress: totalLessons ? Math.round((lessonsDone.length / totalLessons) * 100) : 0 } : null,
      grantsAccessTo: e.type === 'subscription' ? unlocked.filter((u) => ((e.data.grantsAccessTo as string[]) ?? []).includes(u.slug)).map((u) => hydrated.get(u.id)?.card).filter(Boolean) : [],
    };
  });
  return { items };
}

export async function completeLesson(ctx: AppContext, customerId: string, entitlementId: string, lessonId: string) {
  const e = await ctx.db.query.entitlements.findFirst({ where: and(eq(s.entitlements.id, entitlementId), ownerFilter(customerId)) });
  if (!e || e.type !== 'course') throw notFound('course');
  if (!isUsable(e, ctx.now())) throw forbidden();
  const product = (await ctx.db.query.products.findFirst({ where: eq(s.products.id, e.productId) }))!;
  const lessons = parseAttributes('course', product.attributes).modules.flatMap((m) => m.lessons.map((l) => l.id));
  if (!lessons.includes(lessonId)) throw badRequest('unknown_lesson');
  await ctx.db.insert(s.courseProgress).values({ entitlementId, lessonId }).onConflictDoNothing();
  return { ok: true };
}

/* ------------------------------- downloads -------------------------------- */

export async function resolveDownload(ctx: AppContext, token: string) {
  const payload = verifyToken<{ e: string; f: string }>(token, ctx.env.APP_SECRET);
  if (!payload) throw new AppError(410, 'link_expired', 'Download link expired — open your library again');
  const e = await ctx.db.query.entitlements.findFirst({ where: eq(s.entitlements.id, payload.e) });
  if (!e || !isUsable(e, ctx.now())) throw forbidden();
  const product = (await ctx.db.query.products.findFirst({ where: eq(s.products.id, e.productId) }))!;
  const files = (product.attributes.files as { key: string; name: string }[] | undefined) ?? [];
  const file = files.find((f) => f.key === payload.f);
  if (!file) throw notFound('file');
  const max = e.data.maxDownloads as number | null | undefined;
  if (max && e.downloadsUsed >= max) throw conflict('download_limit', 'Download limit reached');
  await ctx.db.update(s.entitlements).set({ downloadsUsed: sql`${s.entitlements.downloadsUsed} + 1` }).where(eq(s.entitlements.id, e.id));

  const root = resolve(ctx.env.STORAGE_DIR);
  const path = normalize(join(root, file.key));
  if (!path.startsWith(root)) throw forbidden();
  if (existsSync(path)) return { name: file.name, stream: createReadStream(path) };
  if (ctx.env.NODE_ENV === 'production') throw notFound('file');
  // demo placeholder so the full purchase → download flow works out of the box
  const watermark = (e.data.watermark as string | undefined) ?? '';
  return { name: `${file.name}.txt`, body: `Demo-Datei für "${file.name}" (${product.slug}).\n${watermark}\nLege die echte Datei unter STORAGE_DIR/${file.key} ab.\n` };
}

/* -------------------------------- diagrams -------------------------------- */

/**
 * Diagram scenes are public when used on the home page or as a product preview;
 * otherwise the customer needs access to a product that contains the diagram.
 */
export async function getDiagram(ctx: AppContext, diagramId: string, customerId?: string): Promise<DiagramScene> {
  const scene = ctx.store.diagrams.get(diagramId);
  if (!scene) throw notFound('diagram');
  const publicIds = new Set(ctx.store.config.home.sections.flatMap((x) => ('diagram' in x && x.diagram ? [x.diagram] : [])));
  if (publicIds.has(diagramId)) return scene;
  const owners = await ctx.db.execute(sql`select id, attributes->>'previewDiagram' as preview from products where status = 'active' and (attributes->'diagrams') ? ${diagramId}`);
  const rows = owners.rows as { id: string; preview: string | null }[];
  if (rows.some((r) => r.preview === diagramId)) return scene;
  if (customerId) for (const r of rows) if (await hasAccess(ctx, customerId, r.id)) return scene;
  throw new AppError(customerId ? 403 : 401, 'diagram_locked', 'Purchase the interactive edition to unlock this diagram');
}

/* ------------------------------ subscriptions ----------------------------- */

export async function listSubscriptions(ctx: AppContext, customerId: string) {
  return ctx.db.select().from(s.subscriptions).where(eq(s.subscriptions.customerId, customerId)).orderBy(desc(s.subscriptions.createdAt));
}

/** § 312k BGB "Kündigungsbutton": cancel to the end of the current period, in one click. */
export async function cancelSubscription(ctx: AppContext, customerId: string, subscriptionId: string) {
  const sub = await ctx.db.query.subscriptions.findFirst({ where: and(eq(s.subscriptions.id, subscriptionId), eq(s.subscriptions.customerId, customerId)) });
  if (!sub) throw notFound('subscription');
  if (sub.status === 'cancelled' || sub.status === 'expired') return sub;
  const [updated] = await ctx.db.update(s.subscriptions).set({ cancelAtPeriodEnd: true }).where(eq(s.subscriptions.id, sub.id)).returning();
  await emit(ctx.db, { type: 'subscription.cancelled', payload: { subscriptionId } });
  return updated!;
}

/**
 * Renewal job: extend active subscriptions whose period ended (the payment provider
 * charges the stored mandate — Stripe Billing in production, auto-success in dev) and
 * expire those cancelled at period end.
 */
export async function renewSubscriptions(ctx: AppContext) {
  const now = ctx.now();
  const due = await ctx.db.select().from(s.subscriptions).where(and(or(eq(s.subscriptions.status, 'active'), eq(s.subscriptions.status, 'trialing')), sql`${s.subscriptions.currentPeriodEnd} <= ${now}`));
  const { addInterval } = await import('@factory/core');
  let renewed = 0;
  for (const sub of due) {
    if (sub.cancelAtPeriodEnd) {
      await ctx.db.update(s.subscriptions).set({ status: 'expired' }).where(eq(s.subscriptions.id, sub.id));
      await ctx.db.update(s.entitlements).set({ status: 'expired' }).where(eq(s.entitlements.subscriptionId, sub.id));
      continue;
    }
    const end = addInterval(sub.currentPeriodEnd, sub.billing);
    await ctx.db.update(s.subscriptions).set({ currentPeriodStart: sub.currentPeriodEnd, currentPeriodEnd: end }).where(eq(s.subscriptions.id, sub.id));
    await ctx.db.update(s.entitlements).set({ expiresAt: end }).where(eq(s.entitlements.subscriptionId, sub.id));
    renewed++;
  }
  return renewed;
}
