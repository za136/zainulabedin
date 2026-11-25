'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { logout } from '@/lib/actions';

export function LogoutButton() {
  const t = useTranslations('nav');
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className="btn-outline" disabled={pending} onClick={() => start(async () => { await logout(); router.replace('/'); })}>
      <LogOut className="h-4 w-4" /> {t('logout')}
    </button>
  );
}
