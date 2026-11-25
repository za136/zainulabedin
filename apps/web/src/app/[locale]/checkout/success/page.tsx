import { CheckCircle2, Clock } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { api, getSessionUser, getStore } from '@/lib/api';
import { money } from '@/lib/format';

export const metadata = { robots: { index: false } };

export default async function SuccessPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ order?: string; token?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { order, token } = await searchParams;
  const t = await getTranslations('success');
  const [o, store, user] = await Promise.all([order ? (await api()).orders.get(order, token).catch(() => null) : null, getStore(), getSessionUser()]);
  if (!o) return <div className="container-page py-20 text-center">404</div>;
  const paid = o.paymentStatus === 'paid';
  const bank = store.payments.find((p) => p.id === o.paymentProvider)?.bank;
  const digital = o.items?.filter((i) => !['physical', 'book', 'service'].includes(i.kind)) ?? [];
  const scheduled = digital.some((i) => i.fulfillmentStatus === 'scheduled');
  const claim = token ? `?claim=${encodeURIComponent(`${o.id}:${token}`)}` : '';
  return (
    <div className="container-page max-w-2xl py-16">
      <div className="card space-y-6 p-8">
        {paid ? <CheckCircle2 className="h-12 w-12 text-success" /> : <Clock className="h-12 w-12 text-accent" />}
        <h1 className="text-3xl font-semibold">{t('title')}</h1>
        <p className="text-lg">{t('number')}: <strong>{o.number}</strong></p>
        <p className="text-muted-foreground">{t('email', { email: o.email })}</p>
        <p className="font-medium">{paid ? t('paid') : t('pending')}</p>
        {!paid && bank && (
          <div className="rounded-[var(--radius-brand)] bg-muted p-5">
            <p className="mb-3 font-semibold">{t('bank')}</p>
            <dl className="grid grid-cols-[140px_1fr] gap-y-1 text-sm">
              <dt>{t('accountHolder')}</dt><dd>{bank.accountHolder}</dd>
              <dt>{t('iban')}</dt><dd className="font-mono">{bank.iban.replace(/(.{4})/g, '$1 ')}</dd>
              {bank.bic && <><dt>{t('bic')}</dt><dd className="font-mono">{bank.bic}</dd></>}
              <dt>{t('reference')}</dt><dd className="font-mono font-semibold">{o.number}</dd>
              <dt>{t('amount')}</dt><dd className="font-semibold">{money(o.totals.total, o.currency, locale)}</dd>
            </dl>
          </div>
        )}
        {paid && digital.length > 0 && <p>{scheduled ? t('digitalScheduled') : t('digitalReady')}</p>}
        <div className="flex flex-wrap gap-3">
          {paid && <a href={`/api/invoice/${o.id}${token ? `?token=${encodeURIComponent(token)}` : ''}`} target="_blank" rel="noreferrer" className="btn-outline">{t('invoice')}</a>}
          {user ? <Link href="/account" className="btn-primary">{t('goLibrary')}</Link> : <Link href={`/account${claim}`} className="btn-primary">{t('createAccount')}</Link>}
        </div>
        {!user && <p className="text-sm text-muted-foreground">{t('createAccountText')}</p>}
      </div>
    </div>
  );
}
