import { BadgeCheck, CalendarClock, Download, GraduationCap, Headphones, KeyRound, Layers, Package } from 'lucide-react';
import type { ProductKind } from '@factory/core';
import { hash } from '@/lib/format';

/**
 * Generative product art: every product gets a distinctive, on-brand visual even
 * without photography. Real images (product.images[0] — local or exported from
 * Canva) always win. Book covers are typeset SVGs; other kinds get iconic cards.
 */
const PALETTES = [
  ['#1d2b6b', '#f2a93b'],
  ['#7c2d12', '#fde68a'],
  ['#064e3b', '#a7f3d0'],
  ['#3b0764', '#f0abfc'],
  ['#0f172a', '#38bdf8'],
  ['#831843', '#fbcfe8'],
  ['#1e3a8a', '#93c5fd'],
  ['#422006', '#fcd34d'],
];

const ICONS: Partial<Record<ProductKind, typeof Package>> = {
  physical: Headphones,
  digital_download: Download,
  license: KeyRound,
  subscription: Layers,
  course: GraduationCap,
  service: CalendarClock,
};

export function ProductArt({ slug, kind, title, subtitle, authors = [], image, size = 'md' }: { slug: string; kind: ProductKind; title: string; subtitle?: string | null; authors?: string[]; image?: { src: string } | null; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  if (image?.src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image.src} alt="" className="aspect-[3/4] w-full rounded-[var(--radius-brand)] object-cover" loading="lazy" />;
  }
  const h = hash(slug.replace(/-(ebook|3d)$/, ''));
  const [bg, fg] = PALETTES[h % PALETTES.length]!;
  const isBook = kind === 'book' || kind === 'ebook' || kind === 'interactive_book';

  if (isBook) {
    const words = title.replace(/ \((E-Book)\)$/, '').replace(/ [–—] 3D[- ]?[Ee]dition$/, '').split(' ').flatMap((w) => (w.length > 14 && w.includes('-') ? w.split(/(?<=-)/) : [w]));
    const lines: string[] = [];
    for (const w of words) {
      const last = lines[lines.length - 1];
      if (last && (last + (last.endsWith('-') ? '' : ' ') + w).length <= 14) lines[lines.length - 1] = last + (last.endsWith('-') ? '' : ' ') + w;
      else lines.push(w);
    }
    const pattern = h % 3;
    return (
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[var(--radius-brand)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)]" aria-hidden>
        <svg viewBox="0 0 300 400" className="h-full w-full" role="img">
          <defs>
            <linearGradient id={`g${h}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={bg} />
              <stop offset="1" stopColor={bg} stopOpacity="0.82" />
            </linearGradient>
          </defs>
          <rect width="300" height="400" fill={`url(#g${h})`} />
          {pattern === 0 && [...Array(7)].map((_, i) => <circle key={i} cx={240 - i * 8} cy={90 + i * 6} r={30 + i * 18} fill="none" stroke={fg} strokeOpacity={0.18 + i * 0.04} strokeWidth="1.5" />)}
          {pattern === 1 && [...Array(9)].map((_, i) => <line key={i} x1={-40 + i * 45} y1="0" x2={60 + i * 45} y2="200" stroke={fg} strokeOpacity="0.22" strokeWidth="10" />)}
          {pattern === 2 && [...Array(5)].map((_, r) => [...Array(5)].map((_, c) => <rect key={`${r}${c}`} x={150 + c * 28} y={20 + r * 28} width="18" height="18" fill={fg} opacity={((r + c + h) % 4) / 5} />))}
          <rect x="0" y="0" width="14" height="400" fill="#000" opacity="0.18" />
          <rect x="28" y="214" width="40" height="5" fill={fg} />
          {lines.slice(0, 4).map((l, i) => (
            <text key={i} x="28" y={size === 'sm' ? 254 + i * 34 : 252 + i * 34} fill="#fff" fontFamily="Georgia, serif" fontSize="30" fontWeight="700">
              {l}
            </text>
          ))}
          {authors[0] && (
            <text x="28" y="378" fill={fg} fontFamily="system-ui, sans-serif" fontSize="15" fontWeight="600" letterSpacing="1">
              {(() => {
                const a = authors.join(' · ').toUpperCase();
                return a.length > 26 ? `${authors[0]!.toUpperCase().slice(0, 22)}${authors.length > 1 ? ' U. A.' : ''}` : a;
              })()}
            </text>
          )}
          {kind === 'interactive_book' && (
            <g transform="translate(222 300)" stroke={fg} strokeWidth="2.5" fill="none">
              <path d="M0 -30 L26 -15 L26 15 L0 30 L-26 15 L-26 -15 Z" />
              <path d="M0 -30 L0 0 L26 15 M0 0 L-26 15" />
            </g>
          )}
        </svg>
        {kind !== 'book' && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold tracking-wider text-black">{kind === 'ebook' ? 'E-BOOK' : '3D'}</span>
        )}
      </div>
    );
  }

  const Icon = ICONS[kind] ?? Package;
  if (size === 'xs')
    return (
      <div className="grid aspect-[3/4] w-full place-items-center rounded-[var(--radius-brand)]" style={{ background: `linear-gradient(160deg, ${bg}, #0b0f1a)` }} aria-hidden>
        <Icon className="h-7 w-7" style={{ color: fg }} strokeWidth={1.5} />
      </div>
    );
  return (
    <div className="relative flex aspect-[3/4] w-full flex-col justify-between overflow-hidden rounded-[var(--radius-brand)] p-5" style={{ background: `radial-gradient(120% 80% at 80% 0%, ${fg}55, transparent 60%), linear-gradient(160deg, ${bg}, #0b0f1a)` }} aria-hidden>
      <div className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full border-[18px] opacity-20" style={{ borderColor: fg }} />
      <Icon className="h-10 w-10" style={{ color: fg }} strokeWidth={1.5} />
      <div>
        <p className="font-heading text-xl font-semibold leading-tight text-white line-clamp-3">{title}</p>
        {subtitle && <p className="mt-1 text-xs text-white/70 line-clamp-2">{subtitle}</p>}
      </div>
      {kind === 'subscription' && <BadgeCheck className="absolute right-4 top-4 h-6 w-6 text-white/80" />}
    </div>
  );
}
