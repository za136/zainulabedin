import { Check } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ProductDetail } from '@factory/sdk';
import { lt } from '@/lib/format';

/**
 * KIND BLOCKS — product-detail sections per product kind. Add a block here when
 * you add a new kind to the registry in @factory/core.
 */
function Table({ rows }: { rows: [string, React.ReactNode][] }) {
  const visible = rows.filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!visible.length) return null;
  return (
    <dl className="divide-y divide-border rounded-[var(--radius-brand)] border border-border text-sm">
      {visible.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[160px_1fr] gap-4 px-4 py-2.5">
          <dt className="text-muted-foreground">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export async function KindBlocks({ product }: { product: ProductDetail }) {
  const t = await getTranslations('product');
  const locale = await getLocale();
  const a = product.attributes;
  const blocks: React.ReactNode[] = [];

  if (product.kind === 'book' || product.kind === 'ebook') {
    blocks.push(
      <section key="book">
        <h2 className="mb-3 text-xl font-semibold">{t('details')}</h2>
        <Table
          rows={[
            [t('isbn'), a.isbn],
            [t('pages'), a.pages],
            [t('binding'), a.binding ? t(`bindings.${a.binding}`) : undefined],
            [t('publisher'), a.publisher],
            [t('language'), a.language?.toUpperCase()],
            [t('formats'), a.files?.map((f: { format?: string }) => f.format?.toUpperCase()).join(', ')],
            ['DRM', product.kind === 'ebook' && a.watermark ? t('watermark') : undefined],
          ]}
        />
      </section>,
    );
  }

  if (product.kind === 'physical') {
    const specs = Object.entries((a.specs ?? {}) as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'string' ? v : lt(v as Record<string, string>, locale)] as [string, string]);
    blocks.push(
      <section key="specs">
        <h2 className="mb-3 text-xl font-semibold">{t('specs')}</h2>
        <Table rows={[...specs, [t('warranty', { months: a.warrantyMonths ?? 24 }), <Check key="w" className="h-4 w-4 text-success" />]]} />
      </section>,
    );
    if (a.gpsr) {
      blocks.push(
        <section key="gpsr">
          <h2 className="mb-3 text-xl font-semibold">{t('safety')}</h2>
          <Table rows={[[t('manufacturer'), `${a.gpsr.manufacturer}, ${a.gpsr.address}`], ['Kontakt / Contact', a.gpsr.contact], ['EU', a.gpsr.responsiblePersonEU], ['⚠', a.gpsr.safetyInformation ? lt(a.gpsr.safetyInformation, locale) : undefined], [t('weee'), a.weeeRegNo]]} />
        </section>,
      );
    }
  }

  if (product.kind === 'course' && Array.isArray(a.modules)) {
    const lessons = a.modules.reduce((n: number, m: { lessons: unknown[] }) => n + m.lessons.length, 0);
    blocks.push(
      <section key="course">
        <h2 className="mb-1 text-xl font-semibold">{t('curriculum')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {t('lessons', { count: lessons })} · {a.level ? t(`levels.${a.level}`) : ''} {a.certificate ? `· ${t('certificate')}` : ''}
        </p>
        <ol className="space-y-3">
          {a.modules.map((m: { id: string; title: Record<string, string>; lessons: { id: string; title: Record<string, string>; durationMinutes?: number; preview?: boolean }[] }, i: number) => (
            <li key={m.id} className="card p-4">
              <p className="font-semibold">{i + 1}. {lt(m.title, locale)}</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {m.lessons.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3">
                    <span>{lt(l.title, locale)} {l.preview && <span className="chip ml-1 py-0 text-[10px]">{t('previewLesson')}</span>}</span>
                    {l.durationMinutes && <span className="tabular-nums">{t('minutes', { count: l.durationMinutes })}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>,
    );
  }

  if (product.kind === 'subscription' && Array.isArray(a.benefits)) {
    blocks.push(
      <section key="sub">
        <h2 className="mb-3 text-xl font-semibold">{t('benefits')}</h2>
        <ul className="space-y-2">
          {a.benefits.map((b: Record<string, string>, i: number) => (
            <li key={i} className="flex items-center gap-2"><Check className="h-5 w-5 text-success" /> {lt(b, locale)}</li>
          ))}
        </ul>
      </section>,
    );
  }

  if (product.kind === 'service') {
    blocks.push(
      <section key="service">
        <h2 className="mb-3 text-xl font-semibold">{t('details')}</h2>
        <Table rows={[[t('duration'), t('minutes', { count: a.durationMinutes })], [t('location'), a.location ? t(`locations.${a.location}`) : undefined]]} />
        {Array.isArray(a.deliverables) && a.deliverables.length > 0 && (
          <>
            <h3 className="mt-5 mb-2 font-semibold">{t('deliverables')}</h3>
            <ul className="space-y-2">{a.deliverables.map((d: Record<string, string>, i: number) => <li key={i} className="flex items-center gap-2"><Check className="h-5 w-5 text-success" /> {lt(d, locale)}</li>)}</ul>
          </>
        )}
      </section>,
    );
  }

  if (product.kind === 'license') {
    blocks.push(
      <section key="license">
        <h2 className="mb-3 text-xl font-semibold">{t('details')}</h2>
        <Table rows={[[t('platforms'), a.platforms?.join(', ')], [t('seats'), a.seats]]} />
      </section>,
    );
  }
  return <div className="space-y-10">{blocks}</div>;
}
