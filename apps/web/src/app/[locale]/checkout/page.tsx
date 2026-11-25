import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckoutForm } from '@/components/cart/checkout-form';
import { redirect } from '@/i18n/navigation';
import { getCartSafe, getSessionUser, getStore } from '@/lib/api';

export const metadata = { robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('checkout');
  const [cart, store, user] = await Promise.all([getCartSafe(), getStore(), getSessionUser()]);
  if (!cart || cart.items.length === 0) redirect({ href: '/cart', locale });
  return (
    <div className="container-page py-10">
      <h1 className="mb-8 text-4xl font-semibold">{t('title')}</h1>
      <CheckoutForm cart={cart!} store={store} email={user?.email} />
    </div>
  );
}
