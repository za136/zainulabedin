import type { Metadata } from 'next';
import { marked } from 'marked';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { legalKey } from '@/lib/format';

async function load(page: string) {
  try {
    return await (await api()).content(legalKey(page));
  } catch {
    notFound();
  }
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const { page } = await params;
  const c = await load(page);
  return { title: c.markdown.match(/^#\s+(.+)$/m)?.[1] ?? page };
}

/** Legal pages come from stores/<id>/content/<locale>/*.md (trusted, store-owned content). */
export default async function LegalPage({ params }: { params: Promise<{ locale: string; page: string }> }) {
  const { locale, page } = await params;
  setRequestLocale(locale);
  const c = await load(page);
  const html = await marked.parse(c.markdown, { breaks: true });
  return (
    <div className="container-page max-w-3xl py-14">
      <article className="prose-legal" lang={c.locale} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
