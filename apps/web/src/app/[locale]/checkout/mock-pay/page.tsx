import { FlaskConical } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { MockPay } from './mock-pay';

export default async function MockPayPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ order?: string; token?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { order, token } = await searchParams;
  const t = await getTranslations('mockPay');
  const o = order && token ? await (await api()).orders.get(order, token).catch(() => null) : null;
  if (!o || !token) return <div className="container-page py-20 text-center">404</div>;
  return (
    <div className="container-page max-w-md py-16">
      <div className="card space-y-5 p-8">
        <FlaskConical className="h-10 w-10 text-accent" />
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('text')}</p>
        <p className="flex justify-between border-y border-border py-3"><span>{t('amount')} · {o.number}</span><strong className="tabular-nums">{money(o.totals.total, o.currency, locale)}</strong></p>
        <MockPay orderId={o.id} token={token} />
      </div>
    </div>
  );
}
