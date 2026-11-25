import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useTranslations } from 'use-intl';
import type { ProductKind } from '@factory/core';
import { Chip, ErrorBox, Loading, P, ProductGrid, Screen, useTheme } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { useAsync } from '@/lib/hooks';

const SORTS = ['newest', 'price_asc', 'price_desc', 'title'] as const;

export default function Catalog() {
  const params = useLocalSearchParams<{ kind?: string; category?: string; q?: string }>();
  const { api, store } = useApp();
  const t = useTranslations();
  const th = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState(params.q ?? '');
  const [submitted, setSubmitted] = useState(params.q ?? '');
  const [sort, setSort] = useState<(typeof SORTS)[number] | undefined>();
  const kind = params.kind as ProductKind | undefined;
  useEffect(() => {
    setQ(params.q ?? '');
    setSubmitted(params.q ?? '');
  }, [params.q]);

  const { data, error, loading, reload } = useAsync(
    () => api.catalog.list({ q: submitted || undefined, kind, category: params.category, sort: sort ?? (submitted ? 'relevance' : undefined), pageSize: 48 }),
    [api, submitted, kind, params.category, sort],
  );
  const setParam = (patch: Record<string, string | undefined>) => router.setParams(patch);

  return (
    <Screen>
      <TextInput
        accessibilityLabel={t('nav.search')}
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => setSubmitted(q.trim())}
        returnKeyType="search"
        placeholder={t('nav.searchPlaceholder')}
        placeholderTextColor={th.mutedFg}
        style={{ borderWidth: 1, borderColor: th.border, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, fontSize: 16, color: th.fg }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label={t('listing.all')} active={!kind} onPress={() => setParam({ kind: undefined })} />
        {store!.catalog.enabledKinds.map((k) => (
          <Chip key={k} label={`${t(`kinds.${k}`)}${data?.facets.kinds[k] !== undefined ? ` (${data.facets.kinds[k]})` : ''}`} active={kind === k} onPress={() => setParam({ kind: k })} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {SORTS.map((s) => (
          <Chip key={s} label={t(`listing.sorts.${s}`)} active={sort === s} onPress={() => setSort(sort === s ? undefined : s)} />
        ))}
      </ScrollView>
      {loading ? <Loading /> : error ? <ErrorBox message={error.message} onRetry={reload} /> : (
        <View style={{ gap: 12 }}>
          <P muted>{t('listing.results', { count: data!.total })}</P>
          {data!.items.length ? <ProductGrid products={data!.items} containerWidth={width} /> : <P muted>{t('listing.empty')}</P>}
        </View>
      )}
    </Screen>
  );
}
