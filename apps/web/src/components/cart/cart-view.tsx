'use client';

import { CalendarClock, Minus, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import type { Cart, StorePublic } from '@factory/sdk';
import { ProductArt } from '@/components/product/product-art';
import { Link, useRouter } from '@/i18n/navigation';
import { setQuantity, updateCart } from '@/lib/actions';
import { dateTime, lt, money } from '@/lib/format';
import { Totals } from './totals';

export function CartView({ initial, store }: { initial: Cart | null; store: StorePublic }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [cart, setCart] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<{ ok: true; data: Cart } | { ok: false; code: string; message: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        setCart(r.data);
        router.refresh();
      } else setError(t.has(`errors.${r.code}`) ? t(`errors.${r.code}`) : r.message);
    });

  if (!cart || cart.items.length === 0)
    return (
      <div className="card p-12 text-center">
        <p className="text-lg">{t('cart.empty')}</p>
        <Link href="/products" className="btn-primary mt-6">{t('cart.continue')}</Link>
      </div>
    );

  const p = cart.pricing;
  const countries = [...new Set(store.shipping.zones.flatMap((z) => z.countries).concat(store.markets.map((m) => m.country)))];
  const freeRate = store.shipping.zones.find((z) => z.countries.includes(cart.country))?.rates.find((r) => r.id === p.shipping.selected?.rateId)?.freeAbove?.[cart.currency];
  const shippable = cart.items.filter((i) => ['physical', 'book'].includes(i.kind)).reduce((s, i) => s + (i.pricing?.total ?? 0), 0);

  return (
    <div className={`grid gap-10 lg:grid-cols-[1fr_380px] ${pending ? 'opacity-70' : ''}`}>
      <div>
        <ul className="divide-y divide-border border-y border-border">
          {cart.items.map((it) => (
            <li key={it.id} className="flex gap-4 py-5">
              <Link href={`/products/${it.slug}`} className="w-20 shrink-0">
                <ProductArt slug={it.slug} kind={it.kind} title={it.title} image={it.image} size="xs" />
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <div>
                    <Link href={`/products/${it.slug}`} className="font-semibold hover:text-primary">{it.title}</Link>
                    <p className="text-xs text-muted-foreground">{t(`kinds.${it.kind}`)}{it.variantTitle ? ` · ${it.variantTitle}` : ''}</p>
                    {it.slot && <p className="mt-1 flex items-center gap-1 text-xs"><CalendarClock className="h-3.5 w-3.5" /> {dateTime(it.slot.startsAt, locale, { dateStyle: 'medium', timeStyle: 'short' })}</p>}
                    {it.priceBound && p.notices.some((n) => n.code === 'price_bound_excluded' && n.lineIds?.includes(it.id)) && <p className="mt-1 text-xs text-muted-foreground">§ {t('cart.priceBoundNote')}</p>}
                    {!it.available && <p className="mt-1 text-xs text-danger">{t('cart.unavailable')}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{money(it.pricing?.total ?? 0, cart.currency, locale)}</p>
                    {!!it.pricing?.discount && <p className="text-xs text-muted-foreground line-through">{money(it.pricing.lineTotal, cart.currency, locale)}</p>}
                  </div>
                </div>
                <div className="mt-auto flex items-center gap-3 pt-3">
                  {it.maxQuantity !== 1 ? (
                    <div className="flex items-center rounded-lg border border-border">
                      <button className="p-2 hover:bg-muted" aria-label="−" onClick={() => act(() => setQuantity(it.id, it.quantity - 1))}><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-8 text-center text-sm tabular-nums" aria-label={t('product.quantity')}>{it.quantity}</span>
                      <button className="p-2 hover:bg-muted" aria-label="+" onClick={() => act(() => setQuantity(it.id, it.quantity + 1))}><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">1 ×</span>
                  )}
                  <button className="btn-ghost px-2 py-1 text-xs text-muted-foreground" onClick={() => act(() => setQuantity(it.id, 0))}>
                    <Trash2 className="h-3.5 w-3.5" /> {t('cart.remove')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {!cart.requiresShipping && <p className="mt-4 text-sm text-muted-foreground">{t('cart.digitalNote')}</p>}
      </div>

      <aside className="card h-fit space-y-5 p-6 lg:sticky lg:top-36">
        <label className="block">
          <span className="label">{t('cart.shipTo')}</span>
          <select className="input" value={cart.country} onChange={(e) => act(() => updateCart({ country: e.target.value }))}>
            {countries.map((c) => <option key={c} value={c}>{t.has(`countries.${c}`) ? t(`countries.${c}`) : c}</option>)}
          </select>
        </label>
        {p.shipping.required && p.shipping.options.length > 1 && (
          <fieldset>
            <legend className="label">{t('cart.shippingMethod')}</legend>
            <div className="space-y-2">
              {p.shipping.options.map((o) => (
                <label key={o.rateId} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <input type="radio" name="rate" checked={p.shipping.selected?.rateId === o.rateId} onChange={() => act(() => updateCart({ shippingRateId: o.rateId }))} />
                    <span>{lt(o.name, locale)}<span className="block text-xs text-muted-foreground">{t('cart.days', { min: o.minDays, max: o.maxDays })}</span></span>
                  </span>
                  <span className="tabular-nums">{o.amount === 0 ? t('cart.free') : money(o.amount, cart.currency, locale)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {freeRate !== undefined && p.shipping.amount > 0 && shippable < freeRate && (
          <p className="rounded-lg bg-muted p-2.5 text-xs">{t('cart.freeShippingHint', { amount: money(freeRate - shippable, cart.currency, locale) })}</p>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const code = new FormData(e.currentTarget).get('code')?.toString().trim();
            if (code) act(() => updateCart({ couponCode: code }));
          }}
        >
          <label className="sr-only" htmlFor="coupon">{t('cart.coupon')}</label>
          <input id="coupon" name="code" className="input" placeholder={t('cart.coupon')} defaultValue={cart.couponCode ?? ''} />
          <button className="btn-outline">{t('cart.apply')}</button>
        </form>
        {p.coupon?.problem && <p className="text-xs text-danger" role="alert">{t(`cart.couponProblem.${p.coupon.problem}`)}</p>}
        {p.coupon?.applied && <p className="flex items-center justify-between text-xs text-success">{t('cart.couponApplied', { code: p.coupon.code })} <button className="underline" onClick={() => act(() => updateCart({ couponCode: null }))}>{t('cart.remove')}</button></p>}
        {p.notices.some((n) => n.code === 'price_bound_excluded') && <p className="text-xs text-muted-foreground">§ {t('cart.priceBoundNote')}</p>}
        <Totals cart={cart} />
        {cart.problems.map((pr) => <p key={pr} className="text-sm text-danger" role="alert">{t(`cart.problems.${pr}`)}</p>)}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <Link href="/checkout" className={`btn-primary h-12 w-full text-base ${cart.checkoutReady ? '' : 'pointer-events-none opacity-50'}`} aria-disabled={!cart.checkoutReady}>{t('cart.checkout')}</Link>
      </aside>
    </div>
  );
}
