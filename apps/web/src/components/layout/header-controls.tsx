'use client';

import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { setCountry } from '@/lib/actions';

export function SearchBox() {
  const t = useTranslations('nav');
  const router = useRouter();
  const params = useSearchParams();
  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get('q')?.toString().trim();
        router.push(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
      }}
    >
      <label htmlFor="site-search" className="sr-only">{t('search')}</label>
      <input id="site-search" name="q" defaultValue={params.get('q') ?? ''} placeholder={t('searchPlaceholder')} className="input h-10 rounded-full pl-10" />
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </form>
  );
}

export function LocaleSwitcher({ locales }: { locales: string[] }) {
  const locale = useLocale();
  const t = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center text-sm">
      <span className="sr-only">{t('language')}</span>
      <select
        value={locale}
        onChange={(e) => {
          const qs = params.toString();
          router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { locale: e.target.value });
        }}
        className="cursor-pointer rounded-md bg-transparent py-1 pr-1 font-medium uppercase hover:bg-muted"
      >
        {locales.map((l) => (
          <option key={l} value={l}>{l.toUpperCase()}</option>
        ))}
      </select>
    </label>
  );
}

export function CountrySelect({ countries, current }: { countries: { code: string; label: string; currency: string }[]; current: string }) {
  const t = useTranslations('nav');
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="sr-only">{t('deliverTo')}</span>
      <select
        disabled={pending}
        value={current}
        onChange={(e) => start(() => setCountry(e.target.value))}
        className="cursor-pointer rounded-md bg-transparent py-1 font-medium hover:bg-muted"
        title={t('deliverTo')}
      >
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} · {c.currency}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PrivacyNotice({ text, ok }: { text: string; ok: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(!localStorage.getItem('privacy-ack')), []);
  if (!visible) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-border bg-background/95 p-3 text-sm shadow-lg backdrop-blur" role="status">
      <p className="flex-1">{text}</p>
      <button
        className="btn-outline py-1.5"
        onClick={() => {
          localStorage.setItem('privacy-ack', '1');
          setVisible(false);
        }}
      >
        {ok}
      </button>
    </div>
  );
}
