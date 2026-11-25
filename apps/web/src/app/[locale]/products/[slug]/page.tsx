import { Star } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ApiError, type ProductDetail } from '@factory/sdk';
import type { DiagramScene } from '@factory/core';
import { DiagramViewer } from '@/components/diagram/diagram-viewer';
import { AddToCart } from '@/components/product/add-to-cart';
import { KindBlocks } from '@/components/product/kind-blocks';
import { ProductArt } from '@/components/product/product-art';
import { ProductCard } from '@/components/product/product-card';
import { ReviewForm } from '@/components/product/reviews';
import { Link } from '@/i18n/navigation';
import { api, getSessionUser, getStore } from '@/lib/api';
import { dateTime } from '@/lib/format';

async function load(slug: string): Promise<ProductDetail> {
  try {
    return await (await api()).catalog.get(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  return { title: p.title, description: p.description.slice(0, 160), openGraph: { title: p.title, description: p.subtitle ?? undefined } };
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const client = await api();
  const [product, store, user] = await Promise.all([load(slug), getStore(), getSessionUser()]);
  const [slots, reviews, preview] = await Promise.all([
    product.kind === 'service' ? client.catalog.slots(slug).then((r) => r.slots) : Promise.resolve([]),
    store.features.reviews ? client.catalog.reviews(slug) : Promise.resolve({ reviews: [], summary: null }),
    product.previewDiagram ? client.diagram(product.previewDiagram).catch(() => null) : Promise.resolve(null as DiagramScene | null),
  ]);

  // schema.org structured data for rich results
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': product.kind === 'book' || product.kind === 'ebook' ? 'Book' : product.kind === 'course' ? 'Course' : 'Product',
    name: product.title,
    description: product.description,
    ...(product.attributes.isbn ? { isbn: product.attributes.isbn } : {}),
    ...(product.authors.length ? { author: product.authors.map((name) => ({ '@type': 'Person', name })) } : {}),
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    ...(product.rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating.avg, reviewCount: product.rating.count } } : {}),
    offers: product.price ? { '@type': 'Offer', price: (product.price.amount / 100).toFixed(2), priceCurrency: product.price.currency, availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } : undefined,
  };

  return (
    <div className="container-page py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">{t('common.home')}</Link> /{' '}
        <Link href={`/products?kind=${product.kind}`} className="hover:text-foreground">{t(`kinds.${product.kind}`)}</Link>
        {product.categories[0] && product.categories[0].name !== t(`kinds.${product.kind}`) && (
          <>
            {' '}/ <Link href={`/products?category=${product.categories[0].slug}`} className="hover:text-foreground">{product.categories[0].name}</Link>
          </>
        )}
      </nav>

      <div className="mt-6 grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-6">
          <div className="mx-auto max-w-md">
            <ProductArt slug={product.slug} kind={product.kind} title={product.title} subtitle={product.subtitle} authors={product.authors} image={product.images[0]} size="lg" />
          </div>
          {product.editions.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-semibold">{t('product.editions')}</p>
              <div className="grid grid-cols-3 gap-3">
                {product.editions.map((e) => (
                  <ProductCard key={e.id} product={e} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t(`kinds.${product.kind}`)}</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight">{product.title}</h1>
          {product.subtitle && <p className="mt-2 text-lg text-muted-foreground">{product.subtitle}</p>}
          {product.authors.length > 0 && <p className="mt-2">{t('product.by', { names: product.authors.join(', ') })}</p>}
          {product.seller && <p className="mt-1 text-sm text-muted-foreground">{t('product.seller', { name: product.seller.name })}</p>}
          {product.rating && (
            <a href="#reviews" className="mt-2 inline-flex items-center gap-1 text-sm">
              {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= Math.round(product.rating!.avg) ? 'fill-accent text-accent' : 'text-border'}`} />)}
              <span className="ml-1 text-muted-foreground">({product.rating.count})</span>
            </a>
          )}
          <div className="card mt-6 p-6">
            <AddToCart product={product} slots={slots} />
          </div>
          <section className="mt-10">
            <h2 className="mb-3 text-xl font-semibold">{t('product.description')}</h2>
            <p className="whitespace-pre-line leading-relaxed text-foreground/90">{product.description}</p>
          </section>
        </div>
      </div>

      {preview && (
        <section className="mt-16">
          <h2 className="mb-4 text-2xl font-semibold">{t('product.try3d')}</h2>
          <DiagramViewer scene={preview} height={560} />
          {product.kind !== 'interactive_book' && product.attributes.interactiveEditionSlug && (
            <Link href={`/products/${product.attributes.interactiveEditionSlug}`} className="btn-outline mt-4">{t('product.interactiveCta')} →</Link>
          )}
        </section>
      )}

      <div className="mt-16 max-w-3xl">
        <KindBlocks product={product} />
      </div>

      {store.features.reviews && (
        <section id="reviews" className="mt-16 max-w-3xl">
          <h2 className="mb-2 text-2xl font-semibold">{t('product.reviews')}</h2>
          <p className="mb-6 text-xs text-muted-foreground">{t('product.reviewPolicy')}</p>
          {reviews.reviews.length === 0 && <p className="mb-6 text-muted-foreground">{t('product.noReviews')}</p>}
          <ul className="mb-8 space-y-4">
            {reviews.reviews.map((r) => (
              <li key={r.id} className="card p-5">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= r.rating ? 'fill-accent text-accent' : 'text-border'}`} />)}
                  {r.verifiedPurchase && <span className="chip ml-2 border-success text-success">{t('product.verifiedPurchase')}</span>}
                </div>
                {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
                {r.body && <p className="mt-1 text-sm leading-relaxed">{r.body}</p>}
                <p className="mt-2 text-xs text-muted-foreground">{r.authorName} · {dateTime(r.createdAt, locale, { dateStyle: 'medium' })}</p>
              </li>
            ))}
          </ul>
          <ReviewForm slug={product.slug} loggedIn={!!user} />
        </section>
      )}
    </div>
  );
}
