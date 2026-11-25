'use client';

import { Lock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import type { Address, Cart, StorePublic } from '@factory/sdk';
import { Link, useRouter } from '@/i18n/navigation';
import { placeOrder } from '@/lib/actions';
import { legalHref, lt, money } from '@/lib/format';
import { Totals } from './totals';

function AddressFields({ prefix, countries, defaultCountry }: { prefix: string; countries: string[]; defaultCountry: string }) {
  const t = useTranslations();
  const f = (name: string) => `${prefix}.${name}`;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label><span className="label">{t('checkout.firstName')}</span><input required name={f('firstName')} autoComplete="given-name" className="input" /></label>
      <label><span className="label">{t('checkout.lastName')}</span><input required name={f('lastName')} autoComplete="family-name" className="input" /></label>
      <label className="sm:col-span-2"><span className="label">{t('checkout.company')}</span><input name={f('company')} autoComplete="organization" className="input" /></label>
      <label className="sm:col-span-2"><span className="label">{t('checkout.street')}</span><input required name={f('street')} autoComplete="street-address" className="input" /></label>
      <label><span className="label">{t('checkout.zip')}</span><input required name={f('zip')} autoComplete="postal-code" className="input" inputMode="numeric" /></label>
      <label><span className="label">{t('checkout.city')}</span><input required name={f('city')} autoComplete="address-level2" className="input" /></label>
      <label className="sm:col-span-2">
        <span className="label">{t('checkout.country')}</span>
        <select name={f('country')} defaultValue={defaultCountry} className="input" autoComplete="country">
          {countries.map((c) => <option key={c} value={c}>{t.has(`countries.${c}`) ? t(`countries.${c}`) : c}</option>)}
        </select>
      </label>
    </div>
  );
}

function readAddress(fd: FormData, prefix: string): Address {
  const g = (k: string) => (fd.get(`${prefix}.${k}`)?.toString().trim() || undefined) as string;
  return { firstName: g('firstName'), lastName: g('lastName'), company: g('company'), street: g('street'), zip: g('zip'), city: g('city'), country: g('country') };
}

export function CheckoutForm({ cart, store, email }: { cart: Cart; store: StorePublic; email?: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [sameAddress, setSame] = useState(true);
  const [b2b, setB2b] = useState(false);
  const [provider, setProvider] = useState(store.payments[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const countries = [...new Set(store.shipping.zones.flatMap((z) => z.countries).concat(store.markets.map((m) => m.country)))];
  const consentKeys = cart.consents;

  return (
    <form
      className="grid gap-10 lg:grid-cols-[1fr_400px]"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setError(null);
          const billing = readAddress(fd, 'billing');
          const res = await placeOrder({
            email: String(fd.get('email')),
            billingAddress: billing,
            shippingAddress: cart.requiresShipping && !sameAddress ? readAddress(fd, 'shipping') : undefined,
            customerType: b2b ? 'b2b' : 'b2c',
            vatId: b2b ? fd.get('vatId')?.toString() || undefined : undefined,
            consents: { terms: fd.get('consent.terms') === 'on', digital_waiver: fd.get('consent.digital_waiver') === 'on', service_early_start: fd.get('consent.service_early_start') === 'on' },
            paymentProvider: provider,
            createAccountPassword: fd.get('password')?.toString() || undefined,
          });
          if (!res.ok) {
            setError(t.has(`errors.${res.code}`) ? t(`errors.${res.code}`) : res.message);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          const { payment, orderId, accessToken } = res.data;
          if (payment.type === 'redirect') window.location.assign(payment.url);
          else router.push(`/checkout/success?order=${orderId}&token=${encodeURIComponent(accessToken)}`);
        });
      }}
    >
      <div className="space-y-10">
        {error && <p role="alert" className="rounded-lg border border-danger bg-danger/5 p-3 text-sm text-danger">{error}</p>}
        <section>
          <h2 className="mb-4 text-xl font-semibold">{t('checkout.contact')}</h2>
          <label><span className="label">{t('checkout.email')}</span><input required type="email" name="email" defaultValue={email} autoComplete="email" className="input" /></label>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold">{t('checkout.billing')}</h2>
          <AddressFields prefix="billing" countries={countries} defaultCountry={cart.country} />
          {store.features.b2b && (
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b2b} onChange={(e) => setB2b(e.target.checked)} /> {t('checkout.b2b')}</label>
              {b2b && <label><span className="label">{t('checkout.vatId')}</span><input name="vatId" className="input" placeholder="ATU12345678" /></label>}
            </div>
          )}
        </section>

        {cart.requiresShipping && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">{t('checkout.shippingAddress')}</h2>
            <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={sameAddress} onChange={(e) => setSame(e.target.checked)} /> {t('checkout.sameAsBilling')}</label>
            {!sameAddress && <AddressFields prefix="shipping" countries={countries} defaultCountry={cart.country} />}
          </section>
        )}

        <section>
          <h2 className="mb-4 text-xl font-semibold">{t('checkout.payment')}</h2>
          <div className="space-y-2">
            {store.payments.map((p) => (
              <label key={p.id} className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-brand)] border p-4 ${provider === p.id ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
                <input type="radio" name="provider" value={p.id} checked={provider === p.id} onChange={() => setProvider(p.id)} className="mt-1" />
                <span>
                  <span className="block font-medium">{lt(p.label, locale)}</span>
                  <span className="mt-1 flex flex-wrap gap-1">{p.methods.map((m) => <span key={m} className="chip py-0.5">{t.has(`checkout.methods.${m}`) ? t(`checkout.methods.${m}`) : m}</span>)}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold">{t('checkout.createAccount')}</h2>
          <label><span className="label">{t('checkout.password')}</span><input type="password" name="password" minLength={10} autoComplete="new-password" className="input" /></label>
        </section>
      </div>

      <aside className="h-fit space-y-5 lg:sticky lg:top-36">
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('checkout.summary')}</h2>
            <Link href="/cart" className="text-sm text-primary underline">{t('checkout.edit')}</Link>
          </div>
          <ul className="mb-4 space-y-2 text-sm">
            {cart.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>{i.quantity} × {i.title}{i.variantTitle ? ` (${i.variantTitle})` : ''}</span>
                <span className="tabular-nums">{money(i.pricing?.total ?? 0, cart.currency, locale)}</span>
              </li>
            ))}
          </ul>
          <Totals cart={cart} />
        </div>

        <fieldset className="card space-y-3 p-6 text-sm">
          <legend className="sr-only">{t('checkout.consents')}</legend>
          {consentKeys.map((c) => (
            <label key={c.key} className="flex items-start gap-3">
              <input type="checkbox" name={`consent.${c.key}`} required={c.required} className="mt-1 h-4 w-4 shrink-0" />
              <span>
                {lt(c.label, locale)}
                {c.key === 'terms' && (
                  <span className="mt-1 block text-xs">
                    <Link href={legalHref('terms', locale)} className="underline" target="_blank">{t('footer.terms')}</Link> · <Link href={legalHref('withdrawal', locale)} className="underline" target="_blank">{t('footer.withdrawal')}</Link> · <Link href={legalHref('privacy', locale)} className="underline" target="_blank">{t('footer.privacy')}</Link>
                  </span>
                )}
                {c.key === 'digital_waiver' && <span className="mt-1 block text-xs text-muted-foreground">{t('checkout.waiverHint')}</span>}
              </span>
            </label>
          ))}
        </fieldset>

        {/* § 312j Abs. 3 BGB: the button must clearly state the obligation to pay */}
        <button type="submit" disabled={pending || !cart.checkoutReady} className="btn-primary h-14 w-full text-base">
          {pending ? t('checkout.processing') : lt(store.orderButtonLabel, locale)}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> {t('checkout.secure')}</p>
      </aside>
    </form>
  );
}
