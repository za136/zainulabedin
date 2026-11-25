import { and, eq, gt, inArray } from 'drizzle-orm';
import { id, kindDef, parseAttributes, type Locale, type LocalizedText } from '@factory/core';
import type { LoadedStore, ProductSeed } from '@factory/config';
import type { Database } from './client.js';
import * as s from './schema.js';

/**
 * Seed (or re-sync) a database from a store folder. Idempotent: products are
 * matched by slug, variants by SKU, categories by slug — so editing the JSON
 * files and re-running `pnpm db:seed` updates the shop in place.
 */
export async function seedStore(db: Database, store: LoadedStore, opts: { log?: (msg: string) => void; now?: Date } = {}): Promise<{ products: number; categories: number }> {
  const log = opts.log ?? (() => {});
  const now = opts.now ?? new Date();
  const { catalog, config } = store;
  const locales = config.locales.supported;

  return db.transaction(async (tx) => {
    // sellers
    const sellerIds = new Map<string, string>();
    for (const seller of catalog.sellers) {
      const existing = await tx.query.sellers.findFirst({ where: eq(s.sellers.slug, seller.slug) });
      const sid = existing?.id ?? id('sel');
      if (existing) await tx.update(s.sellers).set({ name: seller.name, commissionBps: seller.commissionBps }).where(eq(s.sellers.id, sid));
      else await tx.insert(s.sellers).values({ id: sid, slug: seller.slug, name: seller.name, commissionBps: seller.commissionBps });
      sellerIds.set(seller.slug, sid);
    }

    // categories (parents first)
    const catIds = new Map<string, string>();
    const ordered = [...catalog.categories].sort((a, b) => Number(!!a.parent) - Number(!!b.parent));
    for (const c of ordered) {
      const existing = await tx.query.categories.findFirst({ where: eq(s.categories.slug, c.slug) });
      const cid = existing?.id ?? id('cat');
      const values = { slug: c.slug, parentId: c.parent ? catIds.get(c.parent) ?? null : null, position: c.position, image: c.image ?? null };
      if (existing) await tx.update(s.categories).set(values).where(eq(s.categories.id, cid));
      else await tx.insert(s.categories).values({ id: cid, ...values });
      catIds.set(c.slug, cid);
      await tx.delete(s.categoryTranslations).where(eq(s.categoryTranslations.categoryId, cid));
      const rows = localeRows(locales, c.name).map(([locale, name]) => ({ categoryId: cid, locale, name, description: pick(c.description, locale) }));
      if (rows.length) await tx.insert(s.categoryTranslations).values(rows);
    }

    // products
    for (const p of catalog.products) {
      await upsertProduct(tx as unknown as Database, p, { catIds, sellerIds, locales, priceBindingDefault: config.catalog.priceBindingDefault, now });
    }

    // coupons
    for (const c of catalog.coupons) {
      const values = {
        type: c.type,
        value: c.value,
        currency: c.currency ?? null,
        minSubtotal: c.minSubtotal ?? null,
        appliesToKinds: c.appliesToKinds ?? null,
        appliesToCategories: c.appliesToCategories ?? null,
        startsAt: c.startsAt ?? null,
        endsAt: c.endsAt ?? null,
        usageLimit: c.usageLimit ?? null,
        active: c.active,
      };
      await tx.insert(s.coupons).values({ code: c.code, ...values }).onConflictDoUpdate({ target: s.coupons.code, set: values });
    }

    log(`seeded ${catalog.products.length} products, ${catalog.categories.length} categories, ${catalog.coupons.length} coupons`);
    return { products: catalog.products.length, categories: catalog.categories.length };
  });
}

async function upsertProduct(
  tx: Database,
  p: ProductSeed,
  ctx: { catIds: Map<string, string>; sellerIds: Map<string, string>; locales: Locale[]; priceBindingDefault: boolean; now: Date },
): Promise<void> {
  const def = kindDef(p.kind);
  const attributes = parseAttributes(p.kind, p.attributes) as Record<string, unknown>;
  const existing = await tx.query.products.findFirst({ where: eq(s.products.slug, p.slug) });
  const pid = existing?.id ?? id('prd');
  const values = {
    slug: p.slug,
    kind: p.kind,
    status: p.status,
    featured: p.featured,
    taxCategory: p.taxCategory ?? def.defaultTaxCategory,
    priceBound: def.priceBindingEligible ? (p.priceBound ?? ctx.priceBindingDefault) : false,
    brand: p.brand ?? null,
    sellerId: p.seller ? ctx.sellerIds.get(p.seller) ?? null : null,
    images: p.images,
    attributes,
    tags: p.tags,
    publishedAt: p.status === 'active' ? existing?.publishedAt ?? ctx.now : null,
    updatedAt: ctx.now,
  };
  if (existing) await tx.update(s.products).set(values).where(eq(s.products.id, pid));
  else await tx.insert(s.products).values({ id: pid, ...values });

  await tx.delete(s.productTranslations).where(eq(s.productTranslations.productId, pid));
  const tr = localeRows(ctx.locales, p.title).map(([locale, title]) => ({ productId: pid, locale, title, subtitle: pick(p.subtitle, locale), description: pick(p.description, locale) ?? '' }));
  if (tr.length) await tx.insert(s.productTranslations).values(tr);

  await tx.delete(s.productCategories).where(eq(s.productCategories.productId, pid));
  const pc = p.categories.map((c) => ctx.catIds.get(c)).filter((c): c is string => !!c);
  if (pc.length) await tx.insert(s.productCategories).values(pc.map((categoryId) => ({ productId: pid, categoryId })));

  const keepSkus: string[] = [];
  for (const [position, v] of p.variants.entries()) {
    keepSkus.push(v.sku);
    const ev = await tx.query.variants.findFirst({ where: eq(s.variants.sku, v.sku) });
    const vid = ev?.id ?? id('var');
    const tracked = def.requiresShipping && v.stock !== undefined;
    const vValues = {
      productId: pid,
      sku: v.sku,
      title: v.title ?? null,
      options: v.options,
      position,
      stockOnHand: tracked ? v.stock! : null,
      weightGrams: v.weightGrams,
      unitMeasure: v.unitMeasure ?? null,
      billing: v.billing ?? null,
    };
    if (ev) await tx.update(s.variants).set(vValues).where(eq(s.variants.id, vid));
    else await tx.insert(s.variants).values({ id: vid, ...vValues });
    await tx.delete(s.prices).where(eq(s.prices.variantId, vid));
    const priceRows = Object.entries(v.prices).map(([currency, amount]) => ({ variantId: vid, currency, amount: amount!, compareAt: v.compareAt?.[currency as keyof typeof v.compareAt] ?? null }));
    if (priceRows.length) await tx.insert(s.prices).values(priceRows);
  }
  // remove variants that disappeared from the seed (only if never ordered — order items keep snapshots anyway)
  const all = await tx.select({ id: s.variants.id, sku: s.variants.sku }).from(s.variants).where(eq(s.variants.productId, pid));
  const stale = all.filter((v) => !keepSkus.includes(v.sku)).map((v) => v.id);
  if (stale.length) await tx.delete(s.variants).where(inArray(s.variants.id, stale));

  if (p.kind === 'service' && p.slots?.length) {
    const future = await tx.select({ id: s.serviceSlots.id }).from(s.serviceSlots).where(and(eq(s.serviceSlots.productId, pid), gt(s.serviceSlots.startsAt, ctx.now)));
    if (future.length === 0) {
      await tx.insert(s.serviceSlots).values(
        p.slots.map((slot) => {
          const startsAt = resolveSlotTime(slot.startsAt, ctx.now);
          return { id: id('slt'), productId: pid, startsAt, endsAt: new Date(startsAt.getTime() + slot.durationMinutes * 60_000), capacity: slot.capacity };
        }),
      );
    }
  }
}

function localeRows(locales: Locale[], text: LocalizedText): [Locale, string][] {
  const fallback = text.de ?? Object.values(text)[0] ?? '';
  return locales.map((l) => [l, text[l] ?? fallback]);
}

function pick(text: LocalizedText | undefined, locale: Locale): string | null {
  if (!text) return null;
  return text[locale] ?? text.de ?? Object.values(text)[0] ?? null;
}

/**
 * Slot times in seeds can be absolute ISO strings or relative: "+3d14:00" = in 3 days
 * at 14:00 Europe/Berlin — demo stores always have upcoming appointments.
 */
export function resolveSlotTime(spec: string, now: Date, timeZone = 'Europe/Berlin'): Date {
  const m = /^\+(\d+)d(\d{2}):(\d{2})$/.exec(spec);
  if (!m) return new Date(spec);
  const day = new Date(now.getTime() + Number(m[1]) * 86_400_000);
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(day);
  const guess = new Date(`${ymd}T${m[2]}:${m[3]}:00Z`);
  // offset of the zone at that instant
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asZone = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  return new Date(guess.getTime() - (asZone - guess.getTime()));
}
