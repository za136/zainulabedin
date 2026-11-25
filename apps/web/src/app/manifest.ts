import type { MetadataRoute } from 'next';
import { lt } from '@/lib/format';
import { fetchStorePublic } from '@/lib/store-public';

export const dynamic = 'force-dynamic';

/**
 * Web App Manifest generated from store.json → the storefront installs as an app on
 * iOS (Add to Home Screen), Android, Windows, macOS, Linux and ChromeOS.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const store = await fetchStorePublic();
  const name = store?.name ?? 'Store';
  return {
    id: '/',
    name,
    short_name: name.slice(0, 12),
    description: store ? lt(store.seo.description, store.locales.default) : undefined,
    lang: store?.locales.default ?? 'de',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    orientation: 'any',
    background_color: store?.theme.colors.background ?? '#ffffff',
    theme_color: store?.theme.colors.primary ?? '#1e3a8a',
    categories: ['shopping', 'books', 'education'],
    icons: [
      { src: '/app-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app-icon/512?maskable=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: store?.locales.default === 'de' ? 'Suche' : 'Search', url: '/products' },
      { name: store?.locales.default === 'de' ? 'Warenkorb' : 'Cart', url: '/cart' },
      { name: store?.locales.default === 'de' ? 'Bibliothek' : 'Library', url: '/account' },
    ],
  };
}
