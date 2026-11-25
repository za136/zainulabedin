'use client';

import { ChevronLeft, ChevronRight, Compass, Maximize2, Minimize2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { DiagramScene } from '@factory/core';
import { lt } from '@/lib/format';

const DiagramCanvas = dynamic(() => import('./diagram-canvas'), { ssr: false, loading: () => <Loading /> });

function Loading() {
  const t = useTranslations('diagram');
  return <div className="grid h-full w-full place-items-center text-sm text-white/70">{t('loading')}</div>;
}

/**
 * Interactive 3D diagram with a guided tour. The canvas is client-only and lazily
 * loaded; the same content is rendered as an accessible text outline below it
 * (screen readers, no-WebGL devices, SEO) — required for BFSG accessibility.
 */
export function DiagramViewer({ scene, height = 520, compact = false, startTour = true, fill = false }: { scene: DiagramScene; height?: number; compact?: boolean; startTour?: boolean; /** fill the viewport (embed mode) */ fill?: boolean }) {
  const locale = useLocale();
  const t = useTranslations('diagram');
  const [step, setStep] = useState<number | null>(startTour && scene.steps.length ? 0 : null);
  const [selected, setSelected] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      setWebgl(!!(c.getContext('webgl2') || c.getContext('webgl')));
    } catch {
      setWebgl(false);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!wrap.current?.contains(document.activeElement) && !full) return;
      if (e.key === 'ArrowRight') setStep((s) => Math.min((s ?? -1) + 1, scene.steps.length - 1));
      if (e.key === 'ArrowLeft') setStep((s) => Math.max((s ?? 1) - 1, 0));
      if (e.key === 'Escape') setFull(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene.steps.length, full]);

  const current = step !== null ? scene.steps[step] : undefined;
  const node = selected ? scene.nodes.find((n) => n.id === selected) : undefined;
  const focus = current?.focus ?? [];

  return (
    <div>
      <div
        ref={wrap}
        tabIndex={0}
        aria-label={lt(scene.title, locale)}
        className={`relative overflow-hidden ${full ? 'fixed inset-0 z-[60] rounded-none' : 'rounded-[var(--radius-brand)]'} shadow-xl ring-1 ring-black/10`}
        style={{ height: full || fill ? '100dvh' : height, background: scene.background }}
      >
        {webgl ? (
          <DiagramCanvas scene={scene} locale={locale} focus={focus} selected={selected} onSelect={setSelected} stepCamera={current?.camera} autoRotate={step === null && !selected} />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center text-sm text-white/80">{t('noWebgl')}</div>
        )}

        {/* top bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="pointer-events-auto rounded-lg bg-black/45 px-3 py-2 text-white backdrop-blur">
            <p className="font-heading text-sm font-semibold sm:text-base">{lt(scene.title, locale)}</p>
            {!compact && <p className="hidden text-[11px] text-white/70 sm:block">{t('hint')}</p>}
          </div>
          <div className="pointer-events-auto flex gap-2">
            {scene.steps.length > 0 && (
              <button onClick={() => setStep(step === null ? 0 : null)} className="rounded-lg bg-black/45 p-2 text-white backdrop-blur hover:bg-black/60" title={step === null ? t('tour') : t('explore')} aria-label={step === null ? t('tour') : t('explore')}>
                <Compass className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setFull(!full)} className="rounded-lg bg-black/45 p-2 text-white backdrop-blur hover:bg-black/60" aria-label={full ? t('close') : t('fullscreen')}>
              {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* node detail */}
        {node && (
          <div className="absolute right-3 top-16 w-64 rounded-xl bg-white/95 p-4 text-sm text-slate-900 shadow-lg backdrop-blur" role="dialog" aria-live="polite">
            <p className="flex items-center gap-2 font-semibold">
              <span className="h-3 w-3 rounded-full" style={{ background: node.color }} /> {lt(node.label, locale)}
            </p>
            {node.detail && <p className="mt-2 leading-relaxed text-slate-700">{lt(node.detail, locale)}</p>}
            {node.chapter && <p className="mt-2 text-xs text-slate-500">Kapitel / Chapter {node.chapter}</p>}
          </div>
        )}

        {/* tour */}
        {current && step !== null && (
          <div className="absolute inset-x-3 bottom-3 mx-auto max-w-2xl rounded-xl bg-black/60 p-4 text-white backdrop-blur" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{t('step', { current: step + 1, total: scene.steps.length })}</p>
              <div className="flex gap-1">
                <button disabled={step === 0} onClick={() => setStep(step - 1)} className="rounded-md p-1.5 hover:bg-white/15 disabled:opacity-30" aria-label={t('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button disabled={step === scene.steps.length - 1} onClick={() => setStep(step + 1)} className="rounded-md p-1.5 hover:bg-white/15 disabled:opacity-30" aria-label={t('next')}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-1 font-heading text-lg font-semibold">{lt(current.title, locale)}</p>
            {!compact && <p className="mt-1 text-sm leading-relaxed text-white/85">{lt(current.narration, locale)}</p>}
            <div className="mt-3 flex gap-1">
              {scene.steps.map((s, i) => (
                <button key={s.id} onClick={() => setStep(i)} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-white/25'}`} aria-label={`${i + 1}`} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Accessible outline */}
      <details hidden={fill} className="mt-3 text-sm text-muted-foreground">
        <summary className="cursor-pointer select-none">{lt(scene.title, locale)} — Text</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-6">
          {scene.steps.map((s) => (
            <li key={s.id}>
              <strong>{lt(s.title, locale)}:</strong> {lt(s.narration, locale)}
            </li>
          ))}
        </ol>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          {scene.nodes.map((n) => (
            <li key={n.id}>
              <strong>{lt(n.label, locale)}</strong>
              {n.detail ? ` — ${lt(n.detail, locale)}` : ''}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
