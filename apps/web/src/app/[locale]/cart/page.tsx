import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CartView } from '@/components/cart/cart-view';
import { getCartSafe, getStore } from '@/lib/api';

export const metadata = { robots: { index: false } };

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('cart');
  const [cart, store] = await Promise.all([getCartSafe(), getStore()]);
  return (
    <div className="container-page py-10">
      <h1 className="mb-8 text-4xl font-semibold">{t('title')}</h1>
      <CartView initial={cart} store={store} />
    </div>
  );
}
