import { ImageResponse } from 'next/og';
import { fetchStorePublic } from '@/lib/store-public';

export const dynamic = 'force-dynamic';

/** App icon in any size (16–1024 px) rendered from the store's logo mark and brand colours. */
export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Math.min(1024, Math.max(16, Number((await params).size) || 192));
  const maskable = new URL(req.url).searchParams.has('maskable');
  const store = await fetchStorePublic();
  const bg = store?.theme.colors.primary ?? '#1e3a8a';
  const fg = store?.theme.colors.primaryForeground ?? '#ffffff';
  const accent = store?.theme.colors.accent ?? '#f59e0b';
  const mark = store?.theme.logo.mark ?? store?.name?.[0] ?? 'S';
  const inset = maskable ? size * 0.12 : 0; // maskable icons need a safe zone
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: maskable ? bg : 'transparent' }}>
        <div
          style={{
            margin: inset,
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: bg,
            color: fg,
            borderRadius: maskable ? 0 : size * 0.22,
            fontSize: size * 0.58,
            fontWeight: 700,
            fontFamily: 'serif',
            position: 'relative',
          }}
        >
          {mark}
          <div style={{ position: 'absolute', right: size * 0.16, bottom: size * 0.18, width: size * 0.12, height: size * 0.12, borderRadius: size, background: accent }} />
        </div>
      </div>
    ),
    { width: size, height: size, headers: { 'cache-control': 'public, max-age=3600' } },
  );
}
