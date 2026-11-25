import { Lock } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ApiError } from '@factory/sdk';
import type { DiagramScene } from '@factory/core';
import { DiagramViewer } from '@/components/diagram/diagram-viewer';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { lt } from '@/lib/format';

async function load(id: string): Promise<DiagramScene | 'locked'> {
  try {
    return await (await api()).diagram(id);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return 'locked';
    notFound();
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string; locale: string }> }): Promise<Metadata> {
  const { id, locale } = await params;
  const s = await load(id);
  return { title: s === 'locked' ? '3D' : lt(s.title, locale) };
}

export default async function DiagramPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('diagram');
  const scene = await load(id);
  if (scene === 'locked')
    return (
      <div className="container-page max-w-lg py-24 text-center">
        <Lock className="mx-auto h-10 w-10 text-primary" />
        <p className="mt-4">{t('locked')}</p>
        <Link href="/products?kind=interactive_book" className="btn-primary mt-6">3D →</Link>
      </div>
    );
  return (
    <div className="container-page py-8">
      <h1 className="mb-2 text-3xl font-semibold">{lt(scene.title, locale)}</h1>
      {scene.description && <p className="mb-6 text-muted-foreground">{lt(scene.description, locale)}</p>}
      <DiagramViewer scene={scene} height={680} />
    </div>
  );
}
