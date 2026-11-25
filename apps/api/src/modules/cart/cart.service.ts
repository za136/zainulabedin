import { and, eq, inArray } from 'drizzle-orm';
import { consentRequirements, id, kindDef, priceCart, type Coupon, type PricingLineInput, type PricingResult, type ProductKind, type TaxContext } from '@factory/core';
import { schema as s, type Database } from '@factory/db';
import { resolveMarket, type AppContext, type Market } from '../../context.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';

type CartRow = typeof s.carts.$inferSelect;

export interface CartLine {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  kind: ProductKind;
  title: string;
  variantTitle: string | null;
  sku: string;
  image: { src: string } | null;
  quantity: number;
  maxQuantity: number | null;
  slot: { id: string; startsAt: string; endsAt: string } | null;
  priceBound: boolean;
  sellerId: string | null;
  available: boolean;
}

export async function createCart(ctx: AppContext, market: Market, customerId?: string): Promise<CartRow> {
  const row = { id: id('cart'), customerId: customerId ?? null, currency: market.currency, locale: market.locale, country: market.country };
  const [cart] = await ctx.db.insert(s.carts).values(row).returning();
  return cart!;
}

export async function getCart(db: Database, cartId: string): Promise<CartRow> {
  const cart = await db.query.carts.findFirst({ where: eq(s.carts.id, cartId) });
  if (!cart) throw notFound('cart');
  return cart;
}

async function openCart(db: Database, cartId: string): Promise<CartRow> {
  const cart = await getCart(db, cartId);
  if (cart.status !== 'open') throw conflict('cart_closed', 'Cart was already checked out');
  return cart;
}

export async function loadCoupon(db: Database, code: string | null | undefined): Promise<Coupon | undefined> {
  if (!code) return undefined;
  const c = await db.query.coupons.findFirst({ where: eq(s.coupons.code, code.toUpperCase()) });
  if (!c) return undefined;
  return {
    code: c.code,
    type: c.type,
    value: c.value,
    currency: (c.currency as Coupon['currency']) ?? undefined,
    minSubtotal: c.minSubtotal ?? undefined,
    appliesToKinds: c.appliesToKinds ?? undefined,
    appliesToCategories: c.appliesToCategories ?? undefined,
    startsAt: c.startsAt ?? undefined,
    endsAt: c.endsAt ?? undefined,
    usageLimit: c.usageLimit ?? undefined,
    usedCount: c.usedCount,
    active: c.active,
  };
}

/** Load cart lines joined with catalog data and price them with the core engine. */
export async function priceCartRow(ctx: AppContext, cart: CartRow, taxContext?: Partial<TaxContext>, db: Database = ctx.db): Promise<{ lines: CartLine[]; pricing: PricingResult; inputs: PricingLineInput[] }> {
  const items = await db
    .select({ item: s.cartItems, variant: s.variants, product: s.products, price: s.prices, slot: s.serviceSlots })
    .from(s.cartItems)
    .innerJoin(s.variants, eq(s.variants.id, s.cartItems.variantId))
    .innerJoin(s.products, eq(s.products.id, s.variants.productId))
    .leftJoin(s.prices, and(eq(s.prices.variantId, s.variants.id), eq(s.prices.currency, cart.currency)))
    .leftJoin(s.serviceSlots, eq(s.serviceSlots.id, s.cartItems.slotId))
    .where(eq(s.cartItems.cartId, cart.id))
    .orderBy(s.cartItems.createdAt);

  const productIds = [...new Set(items.map((i) => i.product.id))];
  const [trs, cats] = productIds.length
    ? await Promise.all([
        db.select().from(s.productTranslations).where(and(inArray(s.productTranslations.productId, productIds), eq(s.productTranslations.locale, cart.locale))),
        db.select({ productId: s.productCategories.productId, slug: s.categories.slug }).from(s.productCategories).innerJoin(s.categories, eq(s.categories.id, s.productCategories.categoryId)).where(inArray(s.productCategories.productId, productIds)),
      ])
    : [[], []];

  const lines: CartLine[] = [];
  const inputs: PricingLineInput[] = [];
  for (const { item, variant, product, price, slot } of items) {
    const def = kindDef(product.kind);
    const available = product.status === 'active' && !!price;
    const stockLeft = variant.stockOnHand === null ? null : Math.max(0, variant.stockOnHand - variant.stockReserved);
    const tr = trs.find((t) => t.productId === product.id);
    const variantTitle = variant.title ? variant.title[cart.locale as 'de'] ?? variant.title.de ?? null : Object.values(variant.options).join(' · ') || null;
    lines.push({
      id: item.id,
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      kind: product.kind,
      title: tr?.title ?? product.slug,
      variantTitle,
      sku: variant.sku,
      image: product.images[0] ?? null,
      quantity: item.quantity,
      maxQuantity: def.quantityAllowed ? stockLeft : 1,
      slot: slot ? { id: slot.id, startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() } : null,
      priceBound: product.priceBound,
      sellerId: product.sellerId,
      available,
    });
    if (!available) continue;
    inputs.push({
      id: item.id,
      productId: product.id,
      variantId: variant.id,
      kind: product.kind,
      quantity: item.quantity,
      unitPrice: price!.amount,
      taxCategory: product.taxCategory,
      priceBound: product.priceBound,
      requiresShipping: def.requiresShipping,
      weightGrams: variant.weightGrams,
      categoryIds: cats.filter((c) => c.productId === product.id).map((c) => c.slug),
    });
  }

  const pricing = priceCart({
    currency: cart.currency as PricingResult['currency'],
    lines: inputs,
    tax: ctx.store.config.tax,
    taxContext: { destinationCountry: cart.country, customerType: 'b2c', ...taxContext },
    coupon: await loadCoupon(db, cart.couponCode),
    shippingZones: ctx.store.config.shipping.zones,
    shippingRateId: cart.shippingRateId ?? undefined,
    now: ctx.now(),
  });
  return { lines, pricing, inputs };
}

export async function cartView(ctx: AppContext, cartId: string) {
  const cart = await getCart(ctx.db, cartId);
  const { lines, pricing } = await priceCartRow(ctx, cart);
  const priced = new Map(pricing.lines.map((l) => [l.id, l]));
  const kinds = [...new Set(lines.filter((l) => l.available).map((l) => l.kind))];
  const problems: string[] = [];
  if (lines.some((l) => !l.available)) problems.push('unavailable_items');
  if (pricing.notices.some((n) => n.code === 'shipping_unavailable')) problems.push('shipping_unavailable');
  if (lines.some((l) => l.kind === 'service' && !l.slot)) problems.push('slot_required');
  return {
    id: cart.id,
    status: cart.status,
    currency: cart.currency,
    country: cart.country,
    locale: cart.locale,
    couponCode: cart.couponCode,
    items: lines.map((l) => ({ ...l, pricing: priced.get(l.id) ?? null })),
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    pricing,
    consents: consentRequirements(kinds),
    requiresShipping: pricing.shipping.required,
    checkoutReady: lines.length > 0 && problems.length === 0,
    problems,
  };
}
export type CartView = Awaited<ReturnType<typeof cartView>>;

export async function addItem(ctx: AppContext, cartId: string, input: { variantId: string; quantity: number; slotId?: string }) {
  const cart = await openCart(ctx.db, cartId);
  const variant = await ctx.db.query.variants.findFirst({ where: eq(s.variants.id, input.variantId) });
  if (!variant) throw notFound('variant');
  const product = (await ctx.db.query.products.findFirst({ where: eq(s.products.id, variant.productId) }))!;
  if (product.status !== 'active') throw badRequest('product_unavailable');
  if (!ctx.store.config.catalog.enabledKinds.includes(product.kind)) throw badRequest('product_unavailable');
  const price = await ctx.db.query.prices.findFirst({ where: and(eq(s.prices.variantId, variant.id), eq(s.prices.currency, cart.currency)) });
  if (!price) throw badRequest('not_sold_in_currency', `Not available in ${cart.currency}`);
  const def = kindDef(product.kind);

  if (product.kind === 'service') {
    if (!input.slotId) throw badRequest('slot_required', 'Please choose an appointment');
    const slot = await ctx.db.query.serviceSlots.findFirst({ where: and(eq(s.serviceSlots.id, input.slotId), eq(s.serviceSlots.productId, product.id)) });
    if (!slot || slot.startsAt <= ctx.now()) throw badRequest('slot_unavailable');
    if (slot.booked + input.quantity > slot.capacity) throw conflict('slot_full', 'This appointment is fully booked');
  }

  const existing = await ctx.db.query.cartItems.findFirst({
    where: and(eq(s.cartItems.cartId, cart.id), eq(s.cartItems.variantId, variant.id)),
  });
  const sameSlot = existing && (existing.slotId ?? null) === (input.slotId ?? null);
  let quantity = (sameSlot ? existing!.quantity : 0) + input.quantity;
  if (!def.quantityAllowed) quantity = 1; // digital goods: one per customer
  assertStock(variant, quantity);

  if (existing && sameSlot) await ctx.db.update(s.cartItems).set({ quantity }).where(eq(s.cartItems.id, existing.id));
  else if (existing && product.kind === 'service') await ctx.db.update(s.cartItems).set({ quantity, slotId: input.slotId }).where(eq(s.cartItems.id, existing.id));
  else await ctx.db.insert(s.cartItems).values({ id: id('ci'), cartId: cart.id, variantId: variant.id, quantity, slotId: input.slotId ?? null });
  await touch(ctx.db, cart.id);
  return cartView(ctx, cart.id);
}

function assertStock(variant: typeof s.variants.$inferSelect, quantity: number) {
  if (variant.stockOnHand === null) return;
  const left = variant.stockOnHand - variant.stockReserved;
  if (quantity > left) throw conflict('insufficient_stock', left > 0 ? `Only ${left} left` : 'Out of stock', { available: Math.max(0, left) });
}

export async function updateItem(ctx: AppContext, cartId: string, itemId: string, quantity: number) {
  const cart = await openCart(ctx.db, cartId);
  const item = await ctx.db.query.cartItems.findFirst({ where: and(eq(s.cartItems.id, itemId), eq(s.cartItems.cartId, cart.id)) });
  if (!item) throw notFound('cart item');
  if (quantity <= 0) {
    await ctx.db.delete(s.cartItems).where(eq(s.cartItems.id, itemId));
  } else {
    const variant = (await ctx.db.query.variants.findFirst({ where: eq(s.variants.id, item.variantId) }))!;
    const product = (await ctx.db.query.products.findFirst({ where: eq(s.products.id, variant.productId) }))!;
    const q = kindDef(product.kind).quantityAllowed ? quantity : 1;
    assertStock(variant, q);
    await ctx.db.update(s.cartItems).set({ quantity: q }).where(eq(s.cartItems.id, itemId));
  }
  await touch(ctx.db, cart.id);
  return cartView(ctx, cart.id);
}

export async function updateCart(ctx: AppContext, cartId: string, input: { country?: string; currency?: string; locale?: string; couponCode?: string | null; shippingRateId?: string | null }) {
  const cart = await openCart(ctx.db, cartId);
  const patch: Partial<CartRow> = {};
  if (input.country || input.currency || input.locale) {
    const m = resolveMarket(ctx, { country: input.country ?? cart.country, currency: input.currency ?? (input.country ? undefined : cart.currency), locale: input.locale ?? cart.locale });
    Object.assign(patch, { country: m.country, currency: m.currency, locale: m.locale });
  }
  if (input.couponCode !== undefined) {
    if (input.couponCode === null || input.couponCode === '') patch.couponCode = null;
    else {
      const c = await loadCoupon(ctx.db, input.couponCode);
      if (!c || !c.active) throw badRequest('coupon_invalid', 'Unknown coupon code');
      patch.couponCode = c.code;
    }
  }
  if (input.shippingRateId !== undefined) patch.shippingRateId = input.shippingRateId;
  await ctx.db.update(s.carts).set({ ...patch, updatedAt: new Date() }).where(eq(s.carts.id, cart.id));
  return cartView(ctx, cart.id);
}

async function touch(db: Database, cartId: string) {
  await db.update(s.carts).set({ updatedAt: new Date() }).where(eq(s.carts.id, cartId));
}
