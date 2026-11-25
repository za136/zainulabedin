import { getLocale, getTranslations } from 'next-intl/server';
import type { StorePublic } from '@factory/sdk';
import { Link } from '@/i18n/navigation';
import { legalHref, lt } from '@/lib/format';

export async function Footer({ store }: { store: StorePublic }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const legal = store.legal;
  const methods = [...new Set(store.payments.flatMap((p) => p.methods))];
  return (
    <footer className="mt-24 border-t border-border bg-muted/60">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-heading text-xl font-semibold">{store.name}</p>
          <p className="mt-2 text-sm text-muted-foreground">{lt(store.tagline, locale)}</p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">{t('footer.legal')}</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {(['imprint', 'terms', 'withdrawal', 'privacy', 'shipping'] as const).map((k) => (
              <li key={k}><Link href={legalHref(k, locale)} className="hover:text-foreground">{t(`footer.${k}`)}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">{t('footer.contact')}</p>
          <address className="text-sm not-italic text-muted-foreground">
            {legal.company}<br />{legal.street}<br />{legal.zip} {legal.city}<br />
            <a href={`mailto:${legal.email}`} className="hover:text-foreground">{legal.email}</a>
            {legal.phone && <><br />{legal.phone}</>}
          </address>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">{t('footer.payment')}</p>
          <ul className="flex flex-wrap gap-2">
            {methods.map((m) => (
              <li key={m} className="chip">{t.has(`checkout.methods.${m}`) ? t(`checkout.methods.${m}`) : m}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>{t('footer.vatNote')}</p>
          <p>© {new Date().getFullYear()} {legal.company} · {t('footer.builtWith')}</p>
        </div>
      </div>
    </footer>
  );
}
