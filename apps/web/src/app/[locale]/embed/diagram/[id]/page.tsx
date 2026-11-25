import { headers } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { DiagramScene } from '@factory/core';
import { DiagramViewer } from '@/components/diagram/diagram-viewer';
import { api } from '@/lib/api';

export const metadata = { robots: { index: false } };

/**
 * Chrome-less full-screen diagram for embedding — used by the iOS/Android app
 * (WebView) and by partners (iframe). Covers the shop chrome with a fixed layer.
 * Access rules are the API's: public previews always work; purchased diagrams need
 * an `Authorization: Bearer <session>` header on the WebView request (never a URL token).
 */
export default async function EmbedDiagram({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const auth = (await headers()).get('authorization');
  const client = await api();
  let scene: DiagramScene;
  try {
    scene = auth?.startsWith('Bearer ')
      ? await (await fetch(`${process.env.API_URL ?? 'http://localhost:4000'}/v1/diagrams/${encodeURIComponent(id)}`, { headers: { authorization: auth }, cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(r))))
      : await client.diagram(id);
  } catch {
    notFound();
  }
  return (
    <div className="fixed inset-0 z-[200] overflow-auto bg-black">
      <DiagramViewer scene={scene} height={0} fill />
    </div>
  );
}
