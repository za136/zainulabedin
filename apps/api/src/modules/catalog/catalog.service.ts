import { and, asc, eq, gt, inArray, sql, type SQL } from 'drizzle-orm';
import { adjustGrossPrice, kindDef, lookupRate, resolveTax, unitPrice, type Billing, type Locale, type LocalizedText, type ProductKind, type TaxCategory } from '@factory/core';
import { schema as s } from '@factory/db';
import type { AppContext, Market } from '../../context.js';
import { notFound } from '../../lib/errors.js';

export interface PriceView {
  amount: number;
  currency: string;
  compareAt: number | null;
  unitPrice?: { amount: number; per: string };
}

export type StockState = 'in_stock' | 'low_stock' | 'out_of_stock' | 'unlimited';

export interface VariantView {
  id: string;
  sku: string;
  title: LocalizedText | null;
  options: Record<string, string>;
  price: PriceView | null;
  stock: StockState;
  available: number | null;
  billing: Billing | null;
}

export interface ProductCard {
  id: string;
  slug: string;
  kind: ProductKind;
  title: string;
  subtitle: string | null;
  brand: string | null;
  image: { src: string; alt?: LocalizedText } | null;
  featured: boolean;
  priceBound: boolean;
  price: PriceView | null;
  priceVaries: boolean;
  inStock: boolean;
  rating: { avg: number; count: number } | null;
  authors: string[];
  tags: string[];
  /** Diagram id that can be previewed without purchase (interactive books) */
  previewDiagram: string | null;
}

export interface ProductDetail extends ProductCard {
  description: string;
  images: { src: string; alt?: LocalizedText }[];
  attributes: Record<string, unknown>;
  variants: VariantView[];
  categories: { slug: string; name: string }[];
  tax: { rate: number; treatment: string; category: TaxCategory };
  withdrawal: string;
  requiresShipping: boolean;
  editions: ProductCard[];
  seller: { slug: string; name: string } | null;
}

type ProductRow = typeof s.products.$inferSelect;

/** Price shown to a consumer in `market` (gross, incl. the VAT that will be charged). */
export function displayPrice(ctx: AppContext, stored: number, category: TaxCategory, market: Market): number {
  const tax = ctx.store.config.tax;
  if (tax.smallBusiness) return stored;
  const res = resolveTax(category, { destinationCountry: market.country, customerType: 'b2c' }, tax);
  const origin = lookupRate(tax.originCountry, category, tax).rate;
  return adjustGrossPrice(stored, origin, res.rate, tax.priceStrategy, res.treatment);
}

export async function hydrateProducts(ctx: AppContext, ids: string[], market: Market): Promise<Map<string, { row: ProductRow; card: ProductCard; detail: Omit<ProductDetail, 'editions'> }>> {
  const out = new Map<string, { row: ProductRow; card: ProductCard; detail: Omit<ProductDetail, 'editions'> }>();
  if (ids.length === 0) return out;
  const db = ctx.db;
  const [rows, trs, vars, cats, sellers] = await Promise.all([
    db.select().from(s.products).where(inArray(s.products.id, ids)),
    db.select().from(s.productTranslations).where(and(inArray(s.productTranslations.productId, ids), inArray(s.productTranslations.locale, [market.locale, ctx.store.config.locales.default]))),
    db
      .select({ v: s.variants, price: s.prices })
      .from(s.variants)
      .leftJoin(s.prices, and(eq(s.prices.variantId, s.variants.id), eq(s.prices.currency, market.currency)))
      .where(inArray(s.variants.productId, ids))
      .orderBy(asc(s.variants.position)),
    db
      .select({ productId: s.productCategories.productId, slug: s.categories.slug, name: s.categoryTranslations.name })
      .from(s.productCategories)
      .innerJoin(s.categories, eq(s.categories.id, s.productCategories.categoryId))
      .innerJoin(s.categoryTranslations, and(eq(s.categoryTranslations.categoryId, s.categories.id), eq(s.categoryTranslations.locale, market.locale)))
      .where(inArray(s.productCategories.productId, ids)),
    db.select().from(s.sellers),
  ]);
  const lowStock = ctx.store.config.catalog.lowStockThreshold;

  for (const row of rows) {
    const tr = trs.find((t) => t.productId === row.id && t.locale === market.locale) ?? trs.find((t) => t.productId === row.id);
    const variants: VariantView[] = vars
      .filter((x) => x.v.productId === row.id)
      .map(({ v, price }) => {
        const available = v.stockOnHand === null ? null : Math.max(0, v.stockOnHand - v.stockReserved);
        const stock: StockState = available === null ? 'unlimited' : available === 0 ? 'out_of_stock' : available <= lowStock ? 'low_stock' : 'in_stock';
        let pv: PriceView | null = null;
        if (price) {
          const amount = displayPrice(ctx, price.amount, row.taxCategory, market);
          pv = { amount, currency: market.currency, compareAt: price.compareAt ? displayPrice(ctx, price.compareAt, row.taxCategory, market) : null };
          if (v.unitMeasure) pv.unitPrice = unitPrice(amount, v.unitMeasure);
        }
        return { id: v.id, sku: v.sku, title: v.title, options: v.options, price: pv, stock, available, billing: v.billing };
      });
    const priced = variants.filter((v) => v.price);
    const cheapest = [...priced].sort((a, b) => a.price!.amount - b.price!.amount)[0];
    const attributes = row.attributes;
    const def = kindDef(row.kind);
    const card: ProductCard = {
      id: row.id,
      slug: row.slug,
      kind: row.kind,
      title: tr?.title ?? row.slug,
      subtitle: tr?.subtitle ?? null,
      brand: row.brand,
      image: row.images[0] ?? null,
      featured: row.featured,
      priceBound: row.priceBound,
      price: cheapest?.price ?? null,
      priceVaries: new Set(priced.map((v) => v.price!.amount)).size > 1,
      inStock: variants.some((v) => v.stock !== 'out_of_stock'),
      rating: row.ratingCount > 0 && row.ratingAvg !== null ? { avg: row.ratingAvg / 100, count: row.ratingCount } : null,
      authors: Array.isArray(attributes.authors) ? (attributes.authors as string[]) : [],
      tags: row.tags,
      previewDiagram: typeof attributes.previewDiagram === 'string' ? attributes.previewDiagram : null,
    };
    const res = resolveTax(row.taxCategory, { destinationCountry: market.country, customerType: 'b2c' }, ctx.store.config.tax);
    const seller = row.sellerId ? sellers.find((x) => x.id === row.sellerId) : undefined;
    out.set(row.id, {
      row,
      card,
      detail: {
        ...card,
        description: tr?.description ?? '',
        images: row.images,
        attributes,
        variants,
        categories: cats.filter((c) => c.productId === row.id).map((c) => ({ slug: c.slug, name: c.name })),
        tax: { rate: res.rate, treatment: res.treatment, category: row.taxCategory },
        withdrawal: def.withdrawal,
        requiresShipping: def.requiresShipping,
        seller: seller ? { slug: seller.slug, name: seller.name } : null,
      },
    });
  }
  return out;
}

export interface ListQuery {
  q?: string;
  kind?: ProductKind;
  category?: string;
  featured?: boolean;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'title';
  page?: number;
  pageSize?: number;
  slugs?: string[];
}

const FTS_CONFIG: Partial<Record<Locale, string>> = { de: 'german', en: 'english', fr: 'french', it: 'italian' };

export async function listProducts(ctx: AppContext, market: Market, query: ListQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, query.pageSize ?? 24));
  const cfg = sql.raw(`'${FTS_CONFIG[market.locale] ?? 'simple'}'`);
  const document = sql`to_tsvector(${cfg}::regconfig, t.title || ' ' || coalesce(t.subtitle, '') || ' ' || t.description || ' ' || coalesce(p.brand, '') || ' ' || coalesce(p.attributes->>'authors', ''))`;
  const tsq = query.q ? sql`websearch_to_tsquery(${cfg}::regconfig, ${query.q})` : undefined;

  const where = (opts: { withKind: boolean }): SQL => {
    const parts: SQL[] = [sql`p.status = 'active'`];
    if (opts.withKind && query.kind) parts.push(sql`p.kind = ${query.kind}`);
    if (query.featured) parts.push(sql`p.featured = true`);
    if (query.slugs?.length) parts.push(sql`p.slug in (${sql.join(query.slugs.map((x) => sql`${x}`), sql`, `)})`);
    if (query.category)
      parts.push(sql`exists (select 1 from product_categories pc join categories c on c.id = pc.category_id
        where pc.product_id = p.id and (c.slug = ${query.category} or c.parent_id = (select id from categories where slug = ${query.category})))`);
    if (tsq) parts.push(sql`(${document} @@ ${tsq} or t.title ilike ${'%' + query.q!.replace(/[%_]/g, '') + '%'} or p.attributes->>'isbn' = ${query.q})`);
    if (query.inStock) parts.push(sql`exists (select 1 from variants v where v.product_id = p.id and (v.stock_on_hand is null or v.stock_on_hand - v.stock_reserved > 0))`);
    if (query.minPrice !== undefined) parts.push(sql`mp.min_price >= ${query.minPrice}`);
    if (query.maxPrice !== undefined) parts.push(sql`mp.min_price <= ${query.maxPrice}`);
    return sql.join(parts, sql` and `);
  };

  const from = sql`from products p
    join product_translations t on t.product_id = p.id and t.locale = ${market.locale}
    left join lateral (select min(pr.amount) as min_price from variants v join prices pr on pr.variant_id = v.id and pr.currency = ${market.currency} where v.product_id = p.id) mp on true`;

  const sort = query.sort ?? (query.q ? 'relevance' : 'newest');
  const orderBy = {
    relevance: tsq ? sql`ts_rank(${document}, ${tsq}) desc, p.featured desc` : sql`p.featured desc, p.published_at desc`,
    newest: sql`p.published_at desc nulls last, p.created_at desc`,
    price_asc: sql`mp.min_price asc nulls last`,
    price_desc: sql`mp.min_price desc nulls last`,
    title: sql`t.title asc`,
  }[sort];

  const [idRows, facetRows] = await Promise.all([
    ctx.db.execute(sql`select p.id, count(*) over() as total ${from} where ${where({ withKind: true })} order by ${orderBy}, p.id limit ${pageSize} offset ${(page - 1) * pageSize}`),
    ctx.db.execute(sql`select p.kind, count(*)::int as n ${from} where ${where({ withKind: false })} group by p.kind`),
  ]);
  const ids = (idRows.rows as { id: string; total: string | number }[]).map((r) => r.id);
  const total = Number((idRows.rows[0] as { total?: string | number } | undefined)?.total ?? 0);
  const hydrated = await hydrateProducts(ctx, ids, market);
  return {
    items: ids.map((i) => hydrated.get(i)!.card),
    page,
    pageSize,
    total,
    pages: Math.ceil(total / pageSize),
    facets: { kinds: Object.fromEntries((facetRows.rows as { kind: string; n: number }[]).map((r) => [r.kind, Number(r.n)])) },
  };
}

export async function getProduct(ctx: AppContext, market: Market, slug: string, opts: { includeDrafts?: boolean } = {}): Promise<ProductDetail> {
  const row = await ctx.db.query.products.findFirst({ where: eq(s.products.slug, slug) });
  if (!row || (row.status !== 'active' && !opts.includeDrafts)) throw notFound('product');
  const h = await hydrateProducts(ctx, [row.id], market);
  const detail = h.get(row.id)!.detail;

  // other editions of the same work (print ↔ e-book ↔ interactive 3D)
  const familyKey = (row.attributes.interactiveEditionSlug as string | undefined) ?? (row.kind === 'interactive_book' ? row.slug : undefined);
  let editions: ProductCard[] = [];
  if (familyKey) {
    const fam = await ctx.db.execute(
      sql`select id from products where status = 'active' and id <> ${row.id} and (slug = ${familyKey} or attributes->>'interactiveEditionSlug' = ${familyKey})`,
    );
    const famIds = (fam.rows as { id: string }[]).map((r) => r.id);
    const fh = await hydrateProducts(ctx, famIds, market);
    editions = famIds.map((i) => fh.get(i)!.card);
  }
  return { ...detail, editions };
}

export async function listCategories(ctx: AppContext, market: Market) {
  const rows = await ctx.db.execute(sql`
    select c.id, c.slug, c.parent_id, c.position, c.image, ct.name, ct.description,
      (select count(*)::int from product_categories pc join products p on p.id = pc.product_id and p.status = 'active' where pc.category_id = c.id) as product_count
    from categories c join category_translations ct on ct.category_id = c.id and ct.locale = ${market.locale}
    order by c.position, ct.name`);
  type Row = { id: string; slug: string; parent_id: string | null; position: number; image: string | null; name: string; description: string | null; product_count: number };
  const all = rows.rows as Row[];
  type Node = { slug: string; name: string; description: string | null; image: string | null; productCount: number; children: Node[] };
  const node = (r: Row): Node => ({ slug: r.slug, name: r.name, description: r.description, image: r.image, productCount: Number(r.product_count), children: all.filter((c) => c.parent_id === r.id).map(node) });
  return all.filter((r) => !r.parent_id).map(node);
}

export async function upcomingSlots(ctx: AppContext, productSlug: string) {
  const product = await ctx.db.query.products.findFirst({ where: eq(s.products.slug, productSlug) });
  if (!product || product.kind !== 'service') throw notFound('service');
  const slots = await ctx.db
    .select()
    .from(s.serviceSlots)
    .where(and(eq(s.serviceSlots.productId, product.id), gt(s.serviceSlots.startsAt, ctx.now())))
    .orderBy(asc(s.serviceSlots.startsAt))
    .limit(50);
  return slots.map((x) => ({ id: x.id, startsAt: x.startsAt.toISOString(), endsAt: x.endsAt.toISOString(), remaining: Math.max(0, x.capacity - x.booked) }));
}
