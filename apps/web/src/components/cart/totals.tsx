import { useLocale, useTranslations } from 'next-intl';
import type { Cart } from '@factory/sdk';
import { lt, money, pct } from '@/lib/format';

export function Totals({ cart }: { cart: Cart }) {
  const t = useTranslations('cart');
  const locale = useLocale();
  const p = cart.pricing;
  const m = (n: number) => money(n, cart.currency, locale);
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between"><dt>{t('subtotal')}</dt><dd className="tabular-nums">{m(p.subtotal)}</dd></div>
      {p.discountTotal > 0 && <div className="flex justify-between text-success"><dt>{t('discount')} {p.coupon?.code && `(${p.coupon.code})`}</dt><dd className="tabular-nums">−{m(p.discountTotal)}</dd></div>}
      {p.shipping.required && (
        <div className="flex justify-between">
          <dt>{t('shipping')}{p.shipping.selected ? ` · ${lt(p.shipping.selected.name, locale)}` : ''}</dt>
          <dd className="tabular-nums">{p.shipping.amount === 0 ? t('free') : m(p.shipping.amount)}</dd>
        </div>
      )}
      <div className="flex justify-between border-t border-border pt-3 text-base font-semibold"><dt>{t('total')}</dt><dd className="tabular-nums">{m(p.total)}</dd></div>
      {p.taxLines.filter((l) => l.rate > 0).map((l) => (
        <div key={`${l.rate}${l.country}`} className="flex justify-between text-xs text-muted-foreground">
          <dt>{l.country && l.country !== 'DE' ? t('vatIncludedCountry', { rate: pct(l.rate, locale), country: l.country }) : t('vatIncluded', { rate: pct(l.rate, locale) })}</dt>
          <dd className="tabular-nums">{m(l.tax)}</dd>
        </div>
      ))}
      {p.invoiceNotes.map((n) => <p key={n} className="text-xs text-muted-foreground">{n}</p>)}
    </dl>
  );
}
