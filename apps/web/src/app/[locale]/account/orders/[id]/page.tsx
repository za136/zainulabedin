import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Totals } from '@/components/cart/totals';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import type { Cart } from '@factory/sdk';

export const metadata = { robots: { index: false } };

export default async function OrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const o = await (await api()).orders.get(id).catch(() => null);
  if (!o) notFound();
  // reuse the cart totals component with the order's frozen totals
  const pseudoCart = { currency: o.currency, pricing: { subtotal: o.totals.subtotal, discountTotal: o.totals.discountTotal, total: o.totals.total, taxLines: o.totals.taxLines, invoiceNotes: o.totals.invoiceNotes, shipping: { required: !!o.shippingAddress, amount: o.totals.shipping, selected: o.totals.shippingRate ? { name: o.totals.shippingRate.name } : undefined }, coupon: undefined } } as unknown as Cart;
  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/account" className="text-sm text-muted-foreground hover:text-foreground">← {t('account.title')}</Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{o.number}</h1>
        <span className="chip">{t(`account.status.${o.status}`)}</span>
      </div>
      <p className="mt-1 text-muted-foreground">{dateTime(o.placedAt, locale)}</p>
      <ul className="mt-8 divide-y divide-border border-y border-border">
        {o.items?.map((i) => (
          <li key={i.id} className="flex justify-between gap-4 py-4 text-sm">
            <div>
              <p className="font-semibold">{i.quantity} × {i.title}{i.variantTitle ? ` (${i.variantTitle})` : ''}</p>
              <p className="text-muted-foreground">{t(`account.fulfillment.${i.fulfillmentStatus}`)}{i.trackingNumber ? ` · ${t('account.tracking')}: ${i.trackingNumber}` : ''}</p>
            </div>
            <p className="tabular-nums">{money(i.total, o.currency, locale)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-6 ml-auto max-w-sm"><Totals cart={pseudoCart} /></div>
      {o.paymentStatus === 'paid' && <a href={`/api/invoice/${o.id}`} target="_blank" rel="noreferrer" className="btn-outline mt-8">{t('account.invoice')}</a>}
    </div>
  );
}
