import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('common');
  return (
    <div className="container-page py-32 text-center">
      <p className="font-heading text-7xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-2xl font-semibold">{t('notFound')}</h1>
      <p className="mt-2 text-muted-foreground">{t('notFoundText')}</p>
      <Link href="/" className="btn-primary mt-8">{t('backHome')}</Link>
    </div>
  );
}
