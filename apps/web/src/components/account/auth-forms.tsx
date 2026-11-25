'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { login, register } from '@/lib/actions';

export function AuthForms({ claim }: { claim?: { orderId: string; token: string } }) {
  const t = useTranslations();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>(claim ? 'register' : 'login');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="card mx-auto max-w-md p-8">
      <div className="mb-6 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm font-medium" role="tablist">
        {(['login', 'register'] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-md py-2 ${mode === m ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
            {t(`account.${m}`)}
          </button>
        ))}
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const email = String(f.get('email'));
          const password = String(f.get('password'));
          start(async () => {
            setError(null);
            const r = mode === 'login' ? await login(email, password, claim) : await register({ email, password, firstName: String(f.get('firstName') || '') || undefined, lastName: String(f.get('lastName') || '') || undefined, marketingConsent: f.get('marketing') === 'on', claim });
            if (r.ok) router.replace('/account');
            else setError(t.has(`errors.${r.code}`) ? t(`errors.${r.code}`) : r.message);
          });
        }}
      >
        {mode === 'register' && (
          <div className="grid grid-cols-2 gap-3">
            <label><span className="label">{t('account.firstName')}</span><input name="firstName" className="input" autoComplete="given-name" /></label>
            <label><span className="label">{t('account.lastName')}</span><input name="lastName" className="input" autoComplete="family-name" /></label>
          </div>
        )}
        <label className="block"><span className="label">{t('account.email')}</span><input required type="email" name="email" className="input" autoComplete="email" /></label>
        <label className="block"><span className="label">{t('account.password')}</span><input required type="password" name="password" minLength={mode === 'register' ? 10 : 1} className="input" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        {mode === 'register' && <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="marketing" className="mt-1" /> {t('account.marketing')}</label>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button className="btn-primary h-11 w-full" disabled={pending}>{t(`account.${mode}`)}</button>
      </form>
    </div>
  );
}
