import { ShoppingBag, User } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import type { StorePublic } from '@factory/sdk';
import { Link } from '@/i18n/navigation';
import { COUNTRY_COOKIE, getCartSafe, getSessionUser } from '@/lib/api';
import { CountrySelect, LocaleSwitcher, SearchBox } from './header-controls';

export async function Header({ store }: { store: StorePublic }) {
  const t = await getTranslations();
  const [user, cart] = await Promise.all([getSessionUser(), getCartSafe()]);
  const country = (await cookies()).get(COUNTRY_COOKIE)?.value ?? store.market.country;
  const kinds = store.catalog.enabledKinds;
  const countries = [...new Set([...store.markets.map((m) => m.country), ...store.shipping.zones.flatMap((z) => z.countries)])].map((code) => ({
    code,
    label: t.has(`countries.${code}`) ? t(`countries.${code}`) : code,
    currency: store.markets.find((m) => m.country === code)?.currency ?? store.markets.find((m) => m.default)?.currency ?? 'EUR',
  }));
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <a href="#main" className="skip-link">{t('nav.skip')}</a>
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={store.name}>
          {store.theme.logo.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.theme.logo.src} alt={store.name} className="h-8" />
          ) : (
            <>
              <span className="grid h-9 w-9 place-items-center rounded-[calc(var(--radius-brand)*0.7)] bg-primary font-heading text-lg font-bold text-primary-foreground">{store.theme.logo.mark ?? store.name[0]}</span>
              <span className="hidden font-heading text-xl font-semibold sm:block">{store.theme.logo.text}</span>
            </>
          )}
        </Link>
        <div className="mx-2 hidden flex-1 md:block">
          <Suspense>
            <SearchBox />
          </Suspense>
        </div>
        <nav className="ml-auto flex items-center gap-1 sm:gap-3" aria-label="Service">
          <CountrySelect countries={countries} current={country} />
          <Suspense>
            <LocaleSwitcher locales={store.locales.supported} />
          </Suspense>
          {user?.role === 'admin' && <Link href="/admin" className="btn-ghost hidden px-3 lg:inline-flex">{t('nav.admin')}</Link>}
          <Link href="/account" className="btn-ghost px-3" aria-label={t('nav.account')}>
            <User className="h-5 w-5" aria-hidden />
            <span className="hidden lg:inline">{user ? user.firstName ?? t('nav.account') : t('nav.login')}</span>
          </Link>
          <Link href="/cart" className="btn-primary relative px-3" aria-label={`${t('nav.cart')} (${cart?.itemCount ?? 0})`}>
            <ShoppingBag className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">{t('nav.cart')}</span>
            {!!cart?.itemCount && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">{cart.itemCount}</span>}
          </Link>
        </nav>
      </div>
      <div className="container-page pb-3 md:hidden">
        <Suspense>
          <SearchBox />
        </Suspense>
      </div>
      <nav className="border-t border-border/60" aria-label={t('nav.products')}>
        <ul className="container-page flex gap-5 overflow-x-auto py-2 text-sm font-medium whitespace-nowrap [scrollbar-width:none]">
          <li><Link href="/products" className="text-muted-foreground hover:text-foreground">{t('listing.all')}</Link></li>
          {kinds.map((k) => (
            <li key={k}><Link href={`/products?kind=${k}`} className="text-muted-foreground hover:text-foreground">{t(`kinds.${k}`)}</Link></li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
