import { getTranslations, setRequestLocale } from 'next-intl/server';
import { api, getSessionUser } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { AdminOrderActions } from './admin-actions';

export const metadata = { robots: { index: false } };

/** Minimal back office on top of /v1/admin/*. Extend freely or plug in a dedicated admin app. */
export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const user = await getSessionUser();
  if (user?.role !== 'admin') return <div className="container-page py-24 text-center">{t('admin.forbidden')}</div>;
  const client = await api();
  const [stats, { orders }] = await Promise.all([client.admin.stats(), client.admin.orders()]);
  const detailed = await Promise.all(orders.slice(0, 25).map((o) => client.orders.get(o.id)));
  return (
    <div className="container-page py-10">
      <h1 className="mb-8 text-4xl font-semibold">{t('admin.title')}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">{t('admin.revenue')}</p>
          {(stats.revenue as { currency: string; total: number; orders: number }[]).map((r) => <p key={r.currency} className="text-2xl font-semibold">{money(r.total, r.currency, locale)} <span className="text-sm font-normal text-muted-foreground">({r.orders})</span></p>)}
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">{t('admin.orders')}</p>
          <ul className="mt-1 text-sm">{(stats.ordersByStatus as { status: string; n: number }[]).map((s) => <li key={s.status}>{t(`account.status.${s.status}`)}: <strong>{s.n}</strong></li>)}</ul>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">{t('admin.lowStock')}</p>
          <ul className="mt-1 text-sm">{(stats.lowStock as { sku: string; available: number }[]).map((s) => <li key={s.sku}>{s.sku}: <strong>{s.available}</strong></li>)}</ul>
        </div>
      </div>
      <div className="mt-10 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground"><tr><th className="py-2">#</th><th>Datum</th><th>E-Mail</th><th>Status</th><th className="text-right">Summe</th><th className="pl-4" /></tr></thead>
          <tbody className="divide-y divide-border">
            {detailed.map((o) => (
              <tr key={o.id} className="align-top">
                <td className="py-3 font-semibold">{o.number}</td>
                <td className="py-3">{dateTime(o.placedAt, locale, { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className="py-3">{o.email}</td>
                <td className="py-3"><span className="chip">{t(`account.status.${o.status}`)}</span><span className="ml-1 text-xs text-muted-foreground">{o.paymentProvider}</span></td>
                <td className="py-3 text-right tabular-nums">{money(o.totals.total, o.currency, locale)}</td>
                <td className="py-3 pl-4"><AdminOrderActions orderId={o.id} status={o.status} provider={o.paymentProvider} shippable={(o.items ?? []).filter((i) => (i.kind === 'physical' || i.kind === 'book') && i.fulfillmentStatus === 'unfulfilled' && o.paymentStatus === 'paid').map((i) => ({ id: i.id, title: i.title }))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
