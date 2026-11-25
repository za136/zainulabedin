import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProductCard as Card } from '@factory/sdk';
import { Link } from '@/i18n/navigation';
import { Price } from './price';
import { ProductArt } from './product-art';

export function ProductCard({ product, priority }: { product: Card; priority?: boolean }) {
  const t = useTranslations();
  return (
    <article className="group relative flex flex-col">
      <Link href={`/products/${product.slug}`} className="block" prefetch={priority}>
        <div className="transition duration-300 group-hover:-translate-y-1">
          <ProductArt slug={product.slug} kind={product.kind} title={product.title} subtitle={product.subtitle} authors={product.authors} image={product.image} size="sm" />
        </div>
        <div className="mt-3 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t(`kinds.${product.kind}`)}</p>
          <h3 className="font-heading text-base font-semibold leading-snug group-hover:text-primary line-clamp-2">{product.title}</h3>
          {product.authors.length > 0 && <p className="text-sm text-muted-foreground">{t('product.by', { names: product.authors.join(', ') })}</p>}
          {product.rating && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground" aria-label={`${product.rating.avg} / 5`}>
              <Star className="h-3.5 w-3.5 fill-accent text-accent" /> {product.rating.avg.toFixed(1)} ({product.rating.count})
            </p>
          )}
        </div>
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <Price price={product.price} from={product.priceVaries} size="sm" />
        {!product.inStock && <span className="text-xs text-danger">{t('product.outOfStock')}</span>}
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: Card[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}
