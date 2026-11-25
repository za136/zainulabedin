'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { mockPay } from '@/lib/actions';

export function MockPay({ orderId, token }: { orderId: string; token: string }) {
  const t = useTranslations('mockPay');
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const go = (outcome: 'success' | 'failure') =>
    start(async () => {
      const r = await mockPay(orderId, token, outcome);
      if (outcome === 'success' && r.ok) router.push(`/checkout/success?order=${orderId}&token=${encodeURIComponent(token)}`);
      else setFailed(true);
    });
  return (
    <div className="space-y-3">
      <button className="btn-primary h-12 w-full" disabled={pending} onClick={() => go('success')}>{t('pay')}</button>
      <button className="btn-outline w-full" disabled={pending} onClick={() => go('failure')}>{t('fail')}</button>
      {failed && <p className="text-sm text-danger" role="alert">{t('failed')}</p>}
    </div>
  );
}
