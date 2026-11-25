import { setRequestLocale } from 'next-intl/server';
import { HomeSections } from '@/components/home/sections';
import { getStore } from '@/lib/api';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const store = await getStore();
  return <HomeSections store={store} />;
}
