'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { adminAction } from '@/lib/actions';

export function AdminOrderActions({ orderId, status, provider, shippable }: { orderId: string; status: string; provider: string; shippable: { id: string; title: string }[] }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (kind: 'markPaid' | 'ship' | 'cancel', itemId?: string) => start(async () => { await adminAction(kind, orderId, itemId); router.refresh(); });
  return (
    <div className="flex flex-wrap gap-2">
      {status === 'pending_payment' && provider === 'prepayment' && <button disabled={pending} onClick={() => run('markPaid')} className="btn-primary px-3 py-1 text-xs">{t('markPaid')}</button>}
      {status === 'pending_payment' && <button disabled={pending} onClick={() => run('cancel')} className="btn-outline px-3 py-1 text-xs">{t('cancel')}</button>}
      {shippable.map((i) => <button key={i.id} disabled={pending} onClick={() => run('ship', i.id)} className="btn-outline px-3 py-1 text-xs">{t('ship')}: {i.title.slice(0, 24)}</button>)}
    </div>
  );
}
