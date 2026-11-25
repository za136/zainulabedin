import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { PrivacyNotice } from '@/components/layout/header-controls';
import { routing } from '@/i18n/routing';
import { getStore } from '@/lib/api';
import { lt } from '@/lib/format';
import '../globals.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const store = await getStore();
  return {
    title: { default: store.name, template: store.seo.titleTemplate.replace('{store}', store.name) },
    description: lt(store.seo.description, locale),
    metadataBase: new URL(store.url),
    alternates: { languages: Object.fromEntries(store.locales.supported.map((l) => [l, l === store.locales.default ? '/' : `/${l}`])) },
    openGraph: { siteName: store.name, locale: locale === 'de' ? 'de_DE' : 'en_GB', type: 'website' },
  };
}

/** Maps store.json → theme to CSS variables consumed by Tailwind (see globals.css). */
function themeVars(theme: Awaited<ReturnType<typeof getStore>>['theme']): CSSProperties {
  const c = theme.colors;
  const stack = (f: string, fallback: string) => `'${f}', ${fallback}`;
  return {
    '--brand-background': c.background,
    '--brand-foreground': c.foreground,
    '--brand-muted': c.muted,
    '--brand-muted-foreground': c.mutedForeground,
    '--brand-border': c.border,
    '--brand-primary': c.primary,
    '--brand-primary-foreground': c.primaryForeground,
    '--brand-accent': c.accent,
    '--brand-accent-foreground': c.accentForeground,
    '--brand-success': c.success,
    '--brand-danger': c.danger,
    '--brand-radius': theme.radius,
    '--brand-font-heading': stack(theme.fonts.heading, "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif"),
    '--brand-font-body': stack(theme.fonts.body, "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"),
  } as CSSProperties;
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [store, t] = await Promise.all([getStore(), getTranslations('common')]);
  return (
    <html lang={locale} style={themeVars(store.theme)} data-theme={store.theme.preset}>
      <body className="min-h-screen font-sans">
        <NextIntlClientProvider>
          <Header store={store} />
          <main id="main">{children}</main>
          <Footer store={store} />
          <PrivacyNotice text={t('privacyNotice')} ok={t('ok')} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
