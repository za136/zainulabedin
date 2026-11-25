import { ArrowRight, BookOpen, Box, CalendarClock, Download, GraduationCap, Headphones, KeyRound, Layers, RotateCcw, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import type { DiagramScene, ProductKind } from '@factory/core';
import type { HomeSection, StorePublic } from '@factory/sdk';
import { DiagramViewer } from '@/components/diagram/diagram-viewer';
import { ProductGrid } from '@/components/product/product-card';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { lt } from '@/lib/format';

const KIND_ICONS: Record<ProductKind, typeof Box> = { physical: Headphones, book: BookOpen, ebook: BookOpen, interactive_book: Box, digital_download: Download, license: KeyRound, subscription: Layers, course: GraduationCap, service: CalendarClock };
const USP_ICONS: Record<string, typeof Box> = { truck: Truck, shield: ShieldCheck, undo: RotateCcw, book: BookOpen, sparkles: Sparkles };

async function loadDiagram(id?: string): Promise<DiagramScene | null> {
  if (!id) return null;
  try {
    return await (await api()).diagram(id);
  } catch {
    return null;
  }
}

export async function HomeSections({ store }: { store: StorePublic }) {
  return (
    <>
      {store.home.sections.map((s, i) => (
        <Section key={i} section={s} store={store} first={i === 0} />
      ))}
    </>
  );
}

async function Section({ section: s, store, first }: { section: HomeSection; store: StorePublic; first: boolean }) {
  const locale = await getLocale();
  const t = await getTranslations();
  switch (s.type) {
    case 'hero': {
      const scene = await loadDiagram(s.diagram);
      return (
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_10%_0%,color-mix(in_oklab,var(--color-accent)_25%,transparent),transparent),radial-gradient(50%_60%_at_100%_100%,color-mix(in_oklab,var(--color-primary)_18%,transparent),transparent)]" />
          <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
            <div>
              <p className="chip mb-5"><Sparkles className="h-3.5 w-3.5 text-accent" /> {lt(store.tagline, locale).split('–')[0]}</p>
              <h1 className="text-4xl font-semibold leading-[1.05] sm:text-6xl">{lt(s.title, locale)}</h1>
              {s.subtitle && <p className="mt-5 max-w-xl text-lg text-muted-foreground">{lt(s.subtitle, locale)}</p>}
              <div className="mt-8 flex flex-wrap gap-3">
                {s.cta && <Link href={s.cta.href} className="btn-primary px-6 py-3 text-base">{lt(s.cta.label, locale)} <ArrowRight className="h-4 w-4" /></Link>}
                {s.secondaryCta && <Link href={s.secondaryCta.href} className="btn-outline px-6 py-3 text-base">{lt(s.secondaryCta.label, locale)}</Link>}
              </div>
            </div>
            {scene ? (
              <DiagramViewer scene={scene} height={460} compact startTour={false} />
            ) : s.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.image} alt="" className="w-full rounded-[var(--radius-brand)] shadow-xl" />
            ) : null}
          </div>
        </section>
      );
    }
    case 'kinds': {
      const kinds = s.kinds ?? store.catalog.enabledKinds;
      return (
        <section className="container-page py-16">
          <h2 className="text-3xl font-semibold">{lt(s.title, locale)}</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {kinds.map((k) => {
              const Icon = KIND_ICONS[k];
              return (
                <Link key={k} href={`/products?kind=${k}`} className="card group flex flex-col gap-3 p-5 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
                  <Icon className="h-7 w-7 text-primary" strokeWidth={1.6} />
                  <span className="font-semibold">{t(`kinds.${k}`)}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{t(`kindText.${k}`)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      );
    }
    case 'products': {
      const list = await (await api()).catalog.list({ ...s.query, pageSize: s.query.limit });
      if (!list.items.length) return null;
      const href = `/products?${new URLSearchParams(Object.entries({ kind: s.query.kind, category: s.query.category, sort: s.query.sort }).filter(([, v]) => v) as [string, string][]).toString()}`;
      return (
        <section className="container-page py-16">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="text-3xl font-semibold">{lt(s.title, locale)}</h2>
            <Link href={href} className="text-sm font-semibold text-primary hover:underline">{t('common.more')} →</Link>
          </div>
          <ProductGrid products={list.items} />
        </section>
      );
    }
    case 'categories': {
      const { categories } = await (await api()).catalog.categories();
      return (
        <section className="container-page py-16">
          <h2 className="text-3xl font-semibold">{lt(s.title, locale)}</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.map((c) => (
              <Link key={c.slug} href={`/products?category=${c.slug}`} className="card group p-5 transition hover:border-primary">
                <p className="font-heading text-lg font-semibold group-hover:text-primary">{c.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('listing.results', { count: c.productCount })}</p>
                {c.children.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{c.children.map((x) => x.name).join(' · ')}</p>}
              </Link>
            ))}
          </div>
        </section>
      );
    }
    case 'usp':
      return (
        <section className="border-y border-border bg-muted/50">
          <ul className="container-page grid gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
            {s.items.map((it, i) => {
              const Icon = USP_ICONS[it.icon] ?? Sparkles;
              return (
                <li key={i} className="flex gap-3">
                  <Icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" strokeWidth={1.6} />
                  <div>
                    <p className="font-semibold">{lt(it.title, locale)}</p>
                    <p className="text-sm text-muted-foreground">{lt(it.text, locale)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      );
    case 'banner': {
      const tone = s.tone === 'accent' ? 'bg-accent text-accent-foreground' : s.tone === 'muted' ? 'bg-muted' : 'bg-primary text-primary-foreground';
      return (
        <section className="container-page py-10">
          <div className={`relative overflow-hidden rounded-[calc(var(--radius-brand)*1.5)] p-10 sm:p-14 ${tone}`}>
            <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full border-[40px] border-current opacity-10" />
            <h2 className="text-3xl font-semibold sm:text-4xl">{lt(s.title, locale)}</h2>
            {s.text && <p className="mt-3 max-w-xl opacity-85">{lt(s.text, locale)}</p>}
            {s.cta && <Link href={s.cta.href} className="btn-accent mt-6 px-6 py-3">{lt(s.cta.label, locale)} <ArrowRight className="h-4 w-4" /></Link>}
          </div>
        </section>
      );
    }
    case 'diagram': {
      const scene = await loadDiagram(s.diagram);
      if (!scene) return null;
      return (
        <section className="container-page grid items-center gap-10 py-16 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <h2 className="text-3xl font-semibold">{lt(s.title, locale)}</h2>
            {s.text && <p className="mt-4 text-muted-foreground">{lt(s.text, locale)}</p>}
            <Link href={`/diagrams/${scene.id}`} className="btn-outline mt-6">{t('diagram.fullscreen')} <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <DiagramViewer scene={scene} height={480} />
        </section>
      );
    }
    default:
      return first ? null : null;
  }
}
