'use client';

import { useTranslations } from 'next-intl';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errors');
  return (
    <div className="container-page py-32 text-center">
      <h1 className="text-2xl font-semibold">{t('default')}</h1>
      <button onClick={reset} className="btn-primary mt-6">↻</button>
    </div>
  );
}
