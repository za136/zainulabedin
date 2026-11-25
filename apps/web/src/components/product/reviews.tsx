'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { submitReview } from '@/lib/actions';

export function ReviewForm({ slug, loggedIn }: { slug: string; loggedIn: boolean }) {
  const t = useTranslations('product');
  const [rating, setRating] = useState(5);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!loggedIn) return <p className="text-sm text-muted-foreground">{t('reviewLogin')}</p>;
  if (msg) return <p className="text-sm text-success">{msg}</p>;
  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await submitReview(slug, rating, String(f.get('title') ?? ''), String(f.get('body') ?? ''));
          setMsg(r.ok ? (r.data.status === 'published' ? t('reviewThanks') : t('reviewPending')) : r.message);
        });
      }}
    >
      <p className="font-semibold">{t('writeReview')}</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} onClick={() => setRating(n)} aria-label={`${n}`}>
            <Star className={`h-6 w-6 ${n <= rating ? 'fill-accent text-accent' : 'text-border'}`} />
          </button>
        ))}
      </div>
      <input name="title" className="input" placeholder={t('reviewTitle')} maxLength={120} />
      <textarea name="body" className="input min-h-24" placeholder={t('reviewBody')} maxLength={4000} />
      <button className="btn-primary" disabled={pending}>{t('reviewSubmit')}</button>
    </form>
  );
}
