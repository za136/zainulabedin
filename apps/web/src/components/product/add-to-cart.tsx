'use client';

import { Check, ShoppingBag } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import type { ProductDetail, Slot } from '@factory/sdk';
import { Link, useRouter } from '@/i18n/navigation';
import { addToCart } from '@/lib/actions';
import { dateTime, lt, money } from '@/lib/format';
import { Price, VatNote } from './price';

export function AddToCart({ product, slots }: { product: ProductDetail; slots: Slot[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [variantId, setVariantId] = useState(product.variants.find((v) => v.stock !== 'out_of_stock')?.id ?? product.variants[0]?.id);
  const [slotId, setSlotId] = useState<string | undefined>(slots.find((s) => s.remaining > 0)?.id);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [pending, start] = useTransition();
  const variant = product.variants.find((v) => v.id === variantId);
  const quantityAllowed = ['physical', 'book', 'license', 'service'].includes(product.kind);
  const isService = product.kind === 'service';
  const label = isService ? t('product.bookNow') : product.kind === 'subscription' ? t('product.subscribe') : t('product.addToCart');
  const disabled = !variant || variant.stock === 'out_of_stock' || !variant.price || (isService && !slotId);

  const stockMsg = !variant
    ? null
    : variant.stock === 'out_of_stock'
      ? <span className="text-danger">{t('product.outOfStock')}</span>
      : variant.stock === 'low_stock'
        ? <span className="text-accent-foreground font-semibold">{t('product.lowStock', { count: variant.available ?? 0 })}</span>
        : variant.stock === 'in_stock'
          ? <span className="text-success">{t('product.inStock')}</span>
          : <span className="text-success">{t('product.instant')}</span>;

  return (
    <div className="space-y-5">
      <div>
        <Price price={variant?.price ?? product.price} size="lg" />
        {variant?.billing && <p className="text-sm text-muted-foreground">{t('product.perInterval', { interval: t(`product.per.${variant.billing.interval}`) })}</p>}
        <VatNote rate={product.tax.rate} treatment={product.tax.treatment} requiresShipping={product.requiresShipping} />
        {product.priceBound && <p className="mt-1 text-xs text-muted-foreground">§ {t('product.priceBound')}</p>}
      </div>

      {product.variants.length > 1 && (
        <fieldset>
          <legend className="label">{t('product.variant')}</legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariantId(v.id)}
                aria-pressed={v.id === variantId}
                disabled={v.stock === 'out_of_stock'}
                className={`rounded-[calc(var(--radius-brand)*0.6)] border px-3 py-2 text-left text-sm transition ${v.id === variantId ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-foreground/40'} disabled:opacity-40 disabled:line-through`}
              >
                <span className="block font-medium">{lt(v.title ?? undefined, locale) || Object.values(v.options).join(' · ') || v.sku}</span>
                {v.price && <span className="text-xs text-muted-foreground">{money(v.price.amount, v.price.currency, locale)}</span>}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {isService && (
        <fieldset>
          <legend className="label">{t('product.chooseSlot')}</legend>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('product.noSlots')}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {slots.map((s) => (
                <label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${slotId === s.id ? 'border-primary ring-1 ring-primary' : 'border-border'} ${s.remaining === 0 ? 'opacity-40' : ''}`}>
                  <input type="radio" name="slot" value={s.id} checked={slotId === s.id} disabled={s.remaining === 0} onChange={() => setSlotId(s.id)} className="accent-[var(--color-primary)]" />
                  <span>
                    <span className="block font-medium">{dateTime(s.startsAt, locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-xs text-muted-foreground">{t('product.slotsLeft', { count: s.remaining })}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}

      <p className="text-sm">{stockMsg}</p>

      <div className="flex gap-3">
        {quantityAllowed && !isService && (
          <label className="w-24">
            <span className="sr-only">{t('product.quantity')}</span>
            <input type="number" min={1} max={variant?.available ?? 99} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="input h-12 text-center" />
          </label>
        )}
        <button
          className="btn-primary h-12 flex-1 text-base"
          disabled={disabled || pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await addToCart(variantId!, qty, slotId);
              if (!res.ok) setError(t.has(`errors.${res.code}`) ? t(`errors.${res.code}`) : t('errors.default'));
              else {
                setAdded(true);
                router.refresh();
              }
            })
          }
        >
          {added ? <Check className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />} {added ? t('product.added') : label}
        </button>
      </div>
      {added && <Link href="/cart" className="btn-outline w-full">{t('product.viewCart')} →</Link>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-muted-foreground">{t(`product.withdrawal.${product.withdrawal}`)}</p>
    </div>
  );
}
