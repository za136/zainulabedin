import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { productKindSchema, type ProductKind } from '@factory/core';
import { ProductGrid } from '@/components/product/product-card';
import { Link } from '@/i18n/navigation';
import { api, getStore } from '@/lib/api';

type Search = { q?: string; kind?: string; category?: string; sort?: string; page?: string; inStock?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const sp = await searchParams;
  const t = await getTranslations();
  const kind = productKindSchema.safeParse(sp.kind);
  return { title: sp.q ? t('listing.searchTitle', { q: sp.q }) : kind.success ? t(`kinds.${kind.data}`) : t('listing.title') };
}

const SORTS = ['relevance', 'newest', 'price_asc', 'price_desc', 'title'] as const;

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations();
  const store = await getStore();
  const kindParse = productKindSchema.safeParse(sp.kind);
  const kind: ProductKind | undefined = kindParse.success ? kindParse.data : undefined;
  const sort = SORTS.includes(sp.sort as (typeof SORTS)[number]) ? sp.sort : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const client = await api();
  const [list, { categories }] = await Promise.all([client.catalog.list({ q: sp.q, kind, category: sp.category, sort, page, pageSize: 24, inStock: sp.inStock === '1' || undefined }), client.catalog.categories()]);

  const href = (patch: Partial<Search>) => {
    const next = { ...sp, page: undefined, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return `/products${qs ? `?${qs}` : ''}`;
  };
  const category = categories.flatMap((c) => [c, ...c.children]).find((c) => c.slug === sp.category);
  const heading = sp.q ? t('listing.searchTitle', { q: sp.q }) : category ? category.name : kind ? t(`kinds.${kind}`) : t('listing.title');

  return (
    <div className="container-page py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">{t('common.home')}</Link> / <span>{t('listing.title')}</span>
      </nav>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold">{heading}</h1>
          <p className="mt-1 text-muted-foreground">{t('listing.results', { count: list.total })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('listing.sort')}:</span>
          {SORTS.filter((s) => s !== 'relevance' || sp.q).map((s) => (
            <Link key={s} href={href({ sort: s })} className={`chip ${sort === s ? 'border-primary text-primary' : ''}`} aria-current={sort === s ? 'true' : undefined}>
              {t(`listing.sorts.${s}`)}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-8 text-sm">
          <div>
            <p className="mb-2 font-semibold">{t('nav.products')}</p>
            <ul className="space-y-1">
              <li><Link href={href({ kind: undefined })} className={!kind ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-foreground'}>{t('listing.all')}</Link></li>
              {store.catalog.enabledKinds.map((k) => (
                <li key={k}>
                  <Link href={href({ kind: k })} className={kind === k ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-foreground'}>
                    {t(`kinds.${k}`)} <span className="text-xs">({list.facets.kinds[k] ?? 0})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 font-semibold">{t('listing.title')}</p>
            <ul className="space-y-1">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={href({ category: sp.category === c.slug ? undefined : c.slug })} className={sp.category === c.slug ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-foreground'}>{c.name}</Link>
                  {c.children.length > 0 && (
                    <ul className="ml-3 mt-1 space-y-1 border-l border-border pl-3">
                      {c.children.map((x) => (
                        <li key={x.slug}><Link href={href({ category: x.slug })} className={sp.category === x.slug ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-foreground'}>{x.name}</Link></li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <Link href={href({ inStock: sp.inStock === '1' ? undefined : '1' })} className="flex items-center gap-2">
            <span className={`grid h-4 w-4 place-items-center rounded border ${sp.inStock === '1' ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{sp.inStock === '1' ? '✓' : ''}</span>
            {t('listing.inStockOnly')}
          </Link>
        </aside>
        <div>
          {list.items.length ? <ProductGrid products={list.items} /> : <p className="card p-10 text-center text-muted-foreground">{t('listing.empty')}</p>}
          {list.pages > 1 && (
            <nav className="mt-12 flex items-center justify-center gap-3" aria-label="Pagination">
              {page > 1 && <Link href={href({ page: String(page - 1) })} className="btn-outline">{t('listing.prev')}</Link>}
              <span className="text-sm text-muted-foreground">{t('listing.page', { page, pages: list.pages })}</span>
              {page < list.pages && <Link href={href({ page: String(page + 1) })} className="btn-outline">{t('listing.next')}</Link>}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
