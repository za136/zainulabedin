'use client';

import { Box, CheckCircle2, Circle, Download, KeyRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import type { LibraryItem, Subscription } from '@factory/sdk';
import { ProductArt } from '@/components/product/product-art';
import { Link } from '@/i18n/navigation';
import { cancelSubscription, completeLesson } from '@/lib/actions';
import { dateTime, lt, money } from '@/lib/format';

export function Library({ items }: { items: LibraryItem[] }) {
  const t = useTranslations('account');
  if (!items.length) return <p className="card p-8 text-muted-foreground">{t('noLibrary')}</p>;
  return (
    <ul className="grid gap-5 md:grid-cols-2">
      {items.map((it) => <LibraryCard key={it.id} item={it} />)}
    </ul>
  );
}

function LibraryCard({ item }: { item: LibraryItem }) {
  const t = useTranslations();
  const locale = useLocale();
  const [done, setDone] = useState(item.course?.completed ?? []);
  const [pending, start] = useTransition();
  const p = item.product;
  return (
    <li className="card flex gap-5 p-5">
      <div className="w-24 shrink-0">{p && <ProductArt slug={p.slug} kind={p.kind} title={p.title} authors={p.authors} image={p.image} size="xs" />}</div>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{p ? t(`kinds.${p.kind}`) : item.type}</p>
          {p && <Link href={`/products/${p.slug}`} className="font-heading text-lg font-semibold hover:text-primary">{p.title}</Link>}
          {!item.available && <p className="text-sm text-accent-foreground">{t('account.availableFrom', { date: dateTime(item.startsAt, locale, { dateStyle: 'medium' }) })}</p>}
          {item.expiresAt && item.available && <p className="text-xs text-muted-foreground">{t('account.expires', { date: dateTime(item.expiresAt, locale, { dateStyle: 'medium' }) })}</p>}
        </div>
        {item.files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.files.map((f) => f.url ? <a key={f.key} href={f.url} className="btn-outline px-3 py-1.5 text-xs"><Download className="h-3.5 w-3.5" /> {f.format?.toUpperCase() ?? f.name}</a> : null)}
          </div>
        )}
        {item.watermark && <p className="text-[11px] text-muted-foreground">{t('account.watermark')}: {item.watermark}</p>}
        {item.available && item.diagrams.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.diagrams.map((d) => <Link key={d} href={`/diagrams/${d}`} className="btn-primary px-3 py-1.5 text-xs"><Box className="h-3.5 w-3.5" /> {t('account.open3d')}</Link>)}
          </div>
        )}
        {item.licenseKeys.length > 0 && (
          <div>
            <p className="flex items-center gap-1 text-xs font-semibold"><KeyRound className="h-3.5 w-3.5" /> {t('account.licenseKeys')}</p>
            {item.licenseKeys.map((k) => <code key={k} className="mt-1 block select-all rounded bg-muted px-2 py-1 font-mono text-sm">{k}</code>)}
          </div>
        )}
        {item.course && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-success" style={{ width: `${Math.round((done.length / Math.max(1, item.course.modules.reduce((n, m) => n + m.lessons.length, 0))) * 100)}%` }} /></div>
            <ul className="mt-3 space-y-1 text-sm">
              {item.course.modules.flatMap((m) => m.lessons).map((l) => (
                <li key={l.id}>
                  <button
                    disabled={!item.available || pending || done.includes(l.id)}
                    onClick={() => start(async () => { const r = await completeLesson(item.id, l.id); if (r.ok) setDone([...done, l.id]); })}
                    className="flex items-center gap-2 text-left disabled:cursor-default"
                    title={done.includes(l.id) ? t('account.done') : t('account.markDone')}
                  >
                    {done.includes(l.id) ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground" />} {lt(l.title, locale)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {item.grantsAccessTo.length > 0 && (
          <div>
            <p className="text-xs font-semibold">{t('account.includedInSub')}</p>
            <ul className="mt-1 space-y-1 text-sm">
              {item.grantsAccessTo.map((g) => <li key={g.id}><Link href={`/products/${g.slug}`} className="text-primary hover:underline">{g.title}</Link>{g.previewDiagram && <> · <Link href={`/diagrams/${g.previewDiagram}`} className="underline">3D</Link></>}</li>)}
            </ul>
          </div>
        )}
      </div>
    </li>
  );
}

/** § 312k BGB: a clearly labelled cancellation button, reachable without login hurdles beyond the account. */
export function Subscriptions({ subs, titles }: { subs: Subscription[]; titles: Record<string, string> }) {
  const t = useTranslations();
  const locale = useLocale();
  const [list, setList] = useState(subs);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!list.length) return null;
  return (
    <ul className="space-y-3">
      {list.map((s) => (
        <li key={s.id} className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-semibold">{titles[s.productId] ?? s.productId}</p>
            <p className="text-sm text-muted-foreground">
              {money(s.amount, s.currency, locale)} / {t(`product.per.${s.billing.interval}`)} ·{' '}
              {s.status === 'expired' ? t('account.status.cancelled') : s.cancelAtPeriodEnd ? t('account.cancelled', { date: dateTime(s.currentPeriodEnd, locale, { dateStyle: 'medium' }) }) : t('account.renews', { date: dateTime(s.currentPeriodEnd, locale, { dateStyle: 'medium' }) })}
            </p>
          </div>
          {s.status === 'active' && !s.cancelAtPeriodEnd && (
            confirm === s.id ? (
              <button className="btn bg-danger text-white" disabled={pending} onClick={() => start(async () => { const r = await cancelSubscription(s.id); if (r.ok) setList(list.map((x) => (x.id === s.id ? r.data : x))); setConfirm(null); })}>{t('account.cancelConfirm')}</button>
            ) : (
              <button className="btn-outline border-danger text-danger" onClick={() => setConfirm(s.id)}>{t('account.cancelSub')}</button>
            )
          )}
        </li>
      ))}
    </ul>
  );
}
