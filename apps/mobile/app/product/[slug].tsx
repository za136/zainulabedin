import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import type { ProductDetail } from '@factory/sdk';
import { Button, Card, Chip, ErrorBox, H1, H2, KeyValue, Loading, P, Price, ProductArt, ProductCard, Row, Screen, useTheme } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { webUrl } from '@/lib/config';
import { dateTime, DIGITAL_KINDS, lt, pct } from '@/lib/format';
import { useAsync, useErrorText } from '@/lib/hooks';

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { api } = useApp();
  const { data, error, loading, reload } = useAsync(() => api.catalog.get(slug), [api, slug]);
  if (loading) return <Loading />;
  if (error || !data) return <Screen><ErrorBox message={error?.message ?? '404'} onRetry={reload} /></Screen>;
  return <Detail product={data} />;
}

function Detail({ product: p }: { product: ProductDetail }) {
  const { api, locale, store, setCart, ensureCart } = useApp();
  const t = useTranslations();
  const th = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const [variantId, setVariantId] = useState(p.variants.find((v) => v.stock !== 'out_of_stock')?.id ?? p.variants[0]?.id);
  const [slotId, setSlotId] = useState<string>();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const slots = useAsync(() => (p.kind === 'service' ? api.catalog.slots(p.slug).then((r) => r.slots) : Promise.resolve([])), [api, p.slug]);
  const variant = p.variants.find((v) => v.id === variantId);

  // App-store rules: digital content bought inside native iOS/Android apps needs store billing.
  const nativeDigital = Platform.OS !== 'web' && DIGITAL_KINDS.has(p.kind);
  const policy = store!.apps.digitalGoodsInNativeApps;

  const add = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const id = await ensureCart();
      setCart(await api.cart.addItem(id, { variantId: variantId!, quantity: qty, slotId }));
      setMsg({ ok: true, text: t('product.added') });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const stock = !variant ? null : variant.stock === 'out_of_stock' ? t('product.outOfStock') : variant.stock === 'low_stock' ? t('product.lowStock', { count: variant.available ?? 0 }) : variant.stock === 'in_stock' ? t('product.inStock') : t('product.instant');
  const vat = p.tax.treatment === 'export' || p.tax.treatment === 'reverse_charge' ? t('product.exportNet') : t('product.inclVat', { rate: pct(p.tax.rate, locale) });

  return (
    <Screen>
      <Stack.Screen options={{ title: p.title }} />
      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
        <View style={{ width: 170 }}>
          <ProductArt slug={p.slug} kind={p.kind} title={p.title} authors={p.authors} />
        </View>
        <View style={{ flex: 1, minWidth: 200, gap: 6 }}>
          <Text style={{ color: th.primary, fontWeight: '700', fontSize: 11, letterSpacing: 1 }}>{t(`kinds.${p.kind}`).toUpperCase()}</Text>
          <H1 style={{ fontSize: 24 }}>{p.title}</H1>
          {p.subtitle ? <P muted>{p.subtitle}</P> : null}
          {p.authors.length ? <P>{t('product.by', { names: p.authors.join(', ') })}</P> : null}
          {p.rating ? <P small>★ {p.rating.avg.toFixed(1)} ({p.rating.count})</P> : null}
        </View>
      </View>

      <Card>
        <Price price={variant?.price ?? p.price} size={26} />
        {variant?.billing ? <P muted small>{t('product.perInterval', { interval: t(`product.per.${variant.billing.interval}`) })}</P> : null}
        <P muted small>{vat}, {p.requiresShipping ? t('product.plusShipping') : t('product.noShipping')}</P>
        {p.priceBound ? <P muted small>§ {t('product.priceBound')}</P> : null}

        {p.variants.length > 1 ? (
          <Row>
            {p.variants.map((v) => (
              <Chip key={v.id} label={lt(v.title ?? undefined, locale) || Object.values(v.options).join(' · ') || v.sku} active={v.id === variantId} onPress={() => setVariantId(v.id)} />
            ))}
          </Row>
        ) : null}

        {p.kind === 'service' ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '700', color: th.fg }}>{t('product.chooseSlot')}</Text>
            {slots.loading ? <Loading /> : (slots.data ?? []).length === 0 ? <P muted>{t('product.noSlots')}</P> : (
              <Row>
                {slots.data!.map((s) => (
                  <Chip key={s.id} active={slotId === s.id} onPress={() => s.remaining > 0 && setSlotId(s.id)} label={`${dateTime(s.startsAt, locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}${s.remaining === 0 ? ' ✕' : ''}`} />
                ))}
              </Row>
            )}
          </View>
        ) : null}

        {stock ? <P small style={{ color: variant?.stock === 'out_of_stock' ? th.danger : th.success }}>{stock}</P> : null}

        {nativeDigital ? (
          policy === 'web-checkout' ? (
            <View style={{ gap: 6 }}>
              <Button title={`↗ ${t('app.buyOnWeb')}`} onPress={() => WebBrowser.openBrowserAsync(webUrl(`/products/${p.slug}`, locale, store!.locales.default))} />
              <P muted small>{t('app.buyOnWebNote')}</P>
            </View>
          ) : (
            <P muted small>{t('app.browseOnly')}</P>
          )
        ) : (
          <View style={{ gap: 8 }}>
            {['physical', 'book', 'license'].includes(p.kind) ? (
              <Row>
                <Text style={{ color: th.fg }}>{t('app.quantity')}</Text>
                <Chip label="−" onPress={() => setQty(Math.max(1, qty - 1))} />
                <Text accessibilityLabel={`${t('app.quantity')} ${qty}`} style={{ fontWeight: '700', minWidth: 24, textAlign: 'center', color: th.fg }}>{qty}</Text>
                <Chip label="+" onPress={() => setQty(qty + 1)} />
              </Row>
            ) : null}
            <Button
              title={p.kind === 'service' ? t('product.bookNow') : p.kind === 'subscription' ? t('product.subscribe') : t('product.addToCart')}
              onPress={add}
              loading={busy}
              disabled={!variant || variant.stock === 'out_of_stock' || (p.kind === 'service' && !slotId)}
            />
            {msg ? (
              <Row>
                <P small style={{ color: msg.ok ? th.success : th.danger }}>{msg.text}</P>
                {msg.ok ? <Text accessibilityRole="link" onPress={() => router.push('/cart')} style={{ fontWeight: '700', color: th.primary }}>{t('product.viewCart')} →</Text> : null}
              </Row>
            ) : null}
          </View>
        )}
        <P muted small>{t(`product.withdrawal.${p.withdrawal}`)}</P>
      </Card>

      {p.previewDiagram ? <Button variant="outline" title={`🧊 ${t('product.try3d')}`} onPress={() => router.push(`/diagram/${p.previewDiagram}`)} /> : null}

      <View style={{ gap: 6 }}>
        <H2>{t('product.description')}</H2>
        <P>{p.description}</P>
      </View>

      <KindDetails product={p} />

      {p.editions.length ? (
        <View style={{ gap: 10 }}>
          <H2>{t('product.editions')}</H2>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
            {p.editions.map((e) => <ProductCard key={e.id} product={e} width={140} />)}
          </ScrollView>
        </View>
      ) : null}
      {p.seller ? <P muted small>{t('product.seller', { name: p.seller.name })}</P> : null}
    </Screen>
  );
}

function KindDetails({ product: p }: { product: ProductDetail }) {
  const t = useTranslations('product');
  const { locale } = useApp();
  const th = useTheme();
  const a = p.attributes;
  if (p.kind === 'book' || p.kind === 'ebook')
    return (
      <View style={{ gap: 8 }}>
        <H2>{t('details')}</H2>
        <KeyValue rows={[[t('isbn'), a.isbn], [t('pages'), a.pages], [t('binding'), a.binding ? t(`bindings.${a.binding}`) : undefined], [t('publisher'), a.publisher], [t('formats'), a.files?.map((f: { format?: string }) => f.format?.toUpperCase()).join(', ')]]} />
      </View>
    );
  if (p.kind === 'physical')
    return (
      <View style={{ gap: 8 }}>
        <H2>{t('specs')}</H2>
        <KeyValue rows={[...Object.entries((a.specs ?? {}) as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'string' ? v : lt(v as Record<string, string>, locale)] as [string, string]), [t('warranty', { months: a.warrantyMonths ?? 24 }), '✓']]} />
        {a.gpsr ? (
          <>
            <H2>{t('safety')}</H2>
            <KeyValue rows={[[t('manufacturer'), `${a.gpsr.manufacturer}, ${a.gpsr.address}`], ['⚠', a.gpsr.safetyInformation ? lt(a.gpsr.safetyInformation, locale) : undefined], [t('weee'), a.weeeRegNo]]} />
          </>
        ) : null}
      </View>
    );
  if (p.kind === 'course' && Array.isArray(a.modules))
    return (
      <View style={{ gap: 8 }}>
        <H2>{t('curriculum')}</H2>
        {a.modules.map((m: { id: string; title: Record<string, string>; lessons: { id: string; title: Record<string, string>; durationMinutes?: number }[] }, i: number) => (
          <Card key={m.id}>
            <Text style={{ fontWeight: '700', color: th.fg }}>{i + 1}. {lt(m.title, locale)}</Text>
            {m.lessons.map((l) => <P key={l.id} small muted>• {lt(l.title, locale)}{l.durationMinutes ? ` · ${t('minutes', { count: l.durationMinutes })}` : ''}</P>)}
          </Card>
        ))}
      </View>
    );
  if ((p.kind === 'subscription' && Array.isArray(a.benefits)) || (p.kind === 'service' && Array.isArray(a.deliverables)))
    return (
      <View style={{ gap: 6 }}>
        <H2>{p.kind === 'service' ? t('deliverables') : t('benefits')}</H2>
        {(p.kind === 'service' ? a.deliverables : a.benefits).map((b: Record<string, string>, i: number) => <P key={i}>✓ {lt(b, locale)}</P>)}
      </View>
    );
  if (p.kind === 'license') return <KeyValue rows={[[t('platforms'), a.platforms?.join(', ')], [t('seats'), a.seats]]} />;
  return <Pressable />;
}
