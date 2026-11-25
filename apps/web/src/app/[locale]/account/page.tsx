import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthForms } from '@/components/account/auth-forms';
import { Library, Subscriptions } from '@/components/account/library';
import { LogoutButton } from '@/components/account/logout-button';
import { Link } from '@/i18n/navigation';
import { api, getSessionUser } from '@/lib/api';
import { dateTime, money } from '@/lib/format';

export const metadata = { robots: { index: false } };

export default async function AccountPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ claim?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { claim } = await searchParams;
  const t = await getTranslations('account');
  const user = await getSessionUser();
  if (!user) {
    const [orderId, token] = claim?.split(':') ?? [];
    return (
      <div className="container-page py-16">
        <h1 className="mb-8 text-center text-4xl font-semibold">{t('title')}</h1>
        <AuthForms claim={orderId && token ? { orderId, token } : undefined} />
      </div>
    );
  }
  const client = await api();
  const [{ items }, { orders }, { subscriptions }] = await Promise.all([client.me.library(), client.me.orders(), client.me.subscriptions()]);
  const titles = Object.fromEntries(items.filter((i) => i.product).map((i) => [i.product!.id, i.product!.title]));
  return (
    <div className="container-page py-10">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-semibold">{t('hello', { name: user.firstName ?? user.email })}</h1>
        <LogoutButton />
      </div>

      <section className="mb-14">
        <h2 className="mb-5 text-2xl font-semibold">{t('library')}</h2>
        <Library items={items.filter((i) => i.type !== 'subscription' || i.grantsAccessTo.length > 0)} />
      </section>

      {subscriptions.length > 0 && (
        <section className="mb-14">
          <h2 className="mb-5 text-2xl font-semibold">{t('subscriptions')}</h2>
          <Subscriptions subs={subscriptions} titles={titles} />
        </section>
      )}

      <section>
        <h2 className="mb-5 text-2xl font-semibold">{t('orders')}</h2>
        {orders.length === 0 ? (
          <p className="text-muted-foreground">{t('noOrders')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-border">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-3 pr-4"><Link href={`/account/orders/${o.id}`} className="font-semibold text-primary hover:underline">{o.number}</Link></td>
                    <td className="py-3 pr-4 text-muted-foreground">{dateTime(o.placedAt, locale, { dateStyle: 'medium' })}</td>
                    <td className="py-3 pr-4"><span className="chip">{t(`status.${o.status}`)}</span></td>
                    <td className="py-3 text-right font-semibold tabular-nums">{money(o.totals.total, o.currency, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
