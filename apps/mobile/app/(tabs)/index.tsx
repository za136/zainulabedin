import { useRouter } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useTranslations } from 'use-intl';
import type { HomeSection } from '@factory/sdk';
import { Button, Card, ErrorBox, H1, H2, Loading, P, ProductGrid, Row, Screen, serif, useTheme } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { lt } from '@/lib/format';
import { useAsync } from '@/lib/hooks';

/** Home: renders the same store.json → home.sections as the website. */
export default function Home() {
  const { store } = useApp();
  return (
    <Screen>
      {store!.home.sections.map((s, i) => (
        <Section key={i} section={s} />
      ))}
    </Screen>
  );
}

function hrefToRoute(href: string): string {
  // map website paths to app routes
  const [path, qs] = href.split('?');
  if (path === '/products') return `/catalog${qs ? `?${qs}` : ''}`;
  if (path?.startsWith('/products/')) return `/product/${path.slice('/products/'.length)}`;
  return '/catalog';
}

function Section({ section: s }: { section: HomeSection }) {
  const { locale, store } = useApp();
  const t = useTranslations();
  const th = useTheme();
  const router = useRouter();
  switch (s.type) {
    case 'hero':
      return (
        <View style={{ backgroundColor: th.primary, borderRadius: th.radius * 1.4, padding: 22, gap: 12 }}>
          <Text style={{ color: th.accent, fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>{store!.name.toUpperCase()}</Text>
          <Text accessibilityRole="header" style={{ color: th.primaryFg, fontFamily: serif, fontSize: 30, fontWeight: '700', lineHeight: 34 }}>{lt(s.title, locale)}</Text>
          {s.subtitle ? <Text style={{ color: th.primaryFg, opacity: 0.85, fontSize: 15, lineHeight: 21 }}>{lt(s.subtitle, locale)}</Text> : null}
          <Row>
            {s.cta ? <Button title={lt(s.cta.label, locale)} variant="accent" onPress={() => router.push(hrefToRoute(s.cta!.href))} /> : null}
            {s.diagram ? <Button title={`🧊 ${t('product.try3d')}`} variant="outline" color={th.primaryFg} style={{ borderColor: 'rgba(255,255,255,0.4)' }} onPress={() => router.push(`/diagram/${s.diagram}`)} /> : null}
          </Row>
        </View>
      );
    case 'kinds': {
      const kinds = s.kinds ?? store!.catalog.enabledKinds;
      return (
        <View style={{ gap: 10 }}>
          <H2>{lt(s.title, locale)}</H2>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {kinds.map((k) => (
              <Pressable key={k} accessibilityRole="link" onPress={() => router.push(`/catalog?kind=${k}`)} style={{ flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderColor: th.border, borderRadius: th.radius, padding: 14, gap: 4 }}>
                <Text style={{ fontWeight: '700', color: th.fg }}>{t(`kinds.${k}`)}</Text>
                <Text style={{ fontSize: 12, color: th.mutedFg }}>{t(`kindText.${k}`)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }
    case 'products':
      return <ProductsSection title={lt(s.title, locale)} query={s.query} />;
    case 'usp':
      return (
        <Card style={{ backgroundColor: th.muted, borderColor: th.muted }}>
          {s.items.map((it, i) => (
            <View key={i}>
              <Text style={{ fontWeight: '700', color: th.fg }}>✓ {lt(it.title, locale)}</Text>
              <P muted small>{lt(it.text, locale)}</P>
            </View>
          ))}
        </Card>
      );
    case 'banner':
      return (
        <View style={{ backgroundColor: s.tone === 'accent' ? th.accent : th.primary, borderRadius: th.radius * 1.4, padding: 22, gap: 10 }}>
          <Text style={{ fontFamily: serif, fontSize: 24, fontWeight: '700', color: s.tone === 'accent' ? th.accentFg : th.primaryFg }}>{lt(s.title, locale)}</Text>
          {s.text ? <Text style={{ color: s.tone === 'accent' ? th.accentFg : th.primaryFg, opacity: 0.9 }}>{lt(s.text, locale)}</Text> : null}
          {s.cta ? <Button title={lt(s.cta.label, locale)} variant="accent" onPress={() => router.push(hrefToRoute(s.cta!.href))} /> : null}
        </View>
      );
    case 'diagram':
      return (
        <Card>
          <H2>{lt(s.title, locale)}</H2>
          {s.text ? <P muted>{lt(s.text, locale)}</P> : null}
          <Button title={`🧊 ${t('product.try3d')}`} onPress={() => router.push(`/diagram/${s.diagram}`)} />
        </Card>
      );
    case 'categories':
      return <CategoriesSection title={lt(s.title, locale)} />;
    default:
      return null;
  }
}

function ProductsSection({ title, query }: { title: string; query: Extract<HomeSection, { type: 'products' }>['query'] }) {
  const { api } = useApp();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const t = useTranslations('app');
  const { data, error, loading, reload } = useAsync(() => api.catalog.list({ ...query, pageSize: query.limit }), [api, JSON.stringify(query)]);
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error.message} onRetry={reload} />;
  if (!data?.items.length) return null;
  return (
    <View style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2>{title}</H2>
        <Text accessibilityRole="link" onPress={() => router.push(`/catalog${query.kind ? `?kind=${query.kind}` : ''}`)} style={{ fontWeight: '700' }}>{t('viewAll')} →</Text>
      </Row>
      <ProductGrid products={data.items} containerWidth={width} />
    </View>
  );
}

function CategoriesSection({ title }: { title: string }) {
  const { api } = useApp();
  const router = useRouter();
  const th = useTheme();
  const { data } = useAsync(() => api.catalog.categories(), [api]);
  if (!data) return null;
  return (
    <View style={{ gap: 10 }}>
      <H1 style={{ fontSize: 22 }}>{title}</H1>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {data.categories.map((c) => (
          <Pressable key={c.slug} accessibilityRole="link" onPress={() => router.push(`/catalog?category=${c.slug}`)} style={{ borderWidth: 1, borderColor: th.border, borderRadius: th.radius, paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ fontWeight: '600', color: th.fg }}>{c.name} <Text style={{ color: th.mutedFg }}>({c.productCount})</Text></Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
