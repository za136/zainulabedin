import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import type { Cart } from '@factory/sdk';
import { Totals } from '@/components/totals';
import { Button, Card, Chip, ErrorBox, Field, H1, P, ProductArt, Row, Screen, useTheme } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { dateTime, lt, money } from '@/lib/format';
import { useErrorText } from '@/lib/hooks';

export default function CartScreen() {
  const { cart, api, setCart, locale, store } = useApp();
  const t = useTranslations();
  const th = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const [coupon, setCoupon] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // refresh when the tab gains focus (prices/stock may have changed)
  useFocusEffect(
    useCallback(() => {
      if (cart) api.cart.get(cart.id).then((c) => setCart(c.status === 'open' ? c : null)).catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart?.id, api]),
  );

  const act = async (fn: () => Promise<Cart>) => {
    setBusy(true);
    setErr(null);
    try {
      setCart(await fn());
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!cart || cart.items.length === 0)
    return (
      <Screen>
        <H1>{t('cart.title')}</H1>
        <P muted>{t('cart.empty')}</P>
        <Button title={t('cart.continue')} onPress={() => router.push('/catalog')} />
      </Screen>
    );

  const p = cart.pricing;
  const countries = [...new Set(store!.shipping.zones.flatMap((z) => z.countries).concat(store!.markets.map((m) => m.country)))];
  return (
    <Screen>
      <H1>{t('cart.title')}</H1>
      {cart.items.map((it) => (
        <Card key={it.id} style={{ flexDirection: 'row', gap: 12, opacity: busy ? 0.6 : 1 }}>
          <Pressable style={{ width: 64 }} onPress={() => router.push(`/product/${it.slug}`)}>
            <ProductArt slug={it.slug} kind={it.kind} title={it.title} compact />
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontWeight: '700', color: th.fg }}>{it.title}</Text>
            <P muted small>{t(`kinds.${it.kind}`)}{it.variantTitle ? ` · ${it.variantTitle}` : ''}</P>
            {it.slot ? <P small>📅 {dateTime(it.slot.startsAt, locale)}</P> : null}
            {it.priceBound && p.notices.some((n) => n.code === 'price_bound_excluded' && n.lineIds?.includes(it.id)) ? <P muted small>§ {t('cart.priceBoundNote')}</P> : null}
            <Row>
              {it.maxQuantity !== 1 ? (
                <>
                  <Chip label="−" onPress={() => act(() => api.cart.setQuantity(cart.id, it.id, it.quantity - 1))} />
                  <Text style={{ fontWeight: '700', color: th.fg }}>{it.quantity}</Text>
                  <Chip label="+" onPress={() => act(() => api.cart.setQuantity(cart.id, it.id, it.quantity + 1))} />
                </>
              ) : null}
              <Chip label={`✕ ${t('cart.remove')}`} onPress={() => act(() => api.cart.removeItem(cart.id, it.id))} />
            </Row>
          </View>
          <Text style={{ fontWeight: '800', color: th.fg }}>{money(it.pricing?.total ?? 0, cart.currency, locale)}</Text>
        </Card>
      ))}

      <Card>
        <Text style={{ fontWeight: '700', color: th.fg }}>{t('cart.shipTo')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {countries.map((c) => <Chip key={c} label={t.has(`countries.${c}`) ? t(`countries.${c}`) : c} active={cart.country === c} onPress={() => act(() => api.cart.update(cart.id, { country: c }))} />)}
        </ScrollView>
        {p.shipping.required && p.shipping.options.length > 1 ? (
          <Row>
            {p.shipping.options.map((o) => (
              <Chip key={o.rateId} active={p.shipping.selected?.rateId === o.rateId} onPress={() => act(() => api.cart.update(cart.id, { shippingRateId: o.rateId }))} label={`${lt(o.name, locale)} · ${o.amount ? money(o.amount, cart.currency, locale) : t('cart.free')}`} />
            ))}
          </Row>
        ) : null}
        <Row style={{ flexWrap: 'nowrap' }}>
          <Field label={t('cart.coupon')} value={coupon} onChangeText={setCoupon} autoCapitalize="characters" />
          <Button title={t('cart.apply')} variant="outline" style={{ alignSelf: 'flex-end' }} onPress={() => coupon.trim() && act(() => api.cart.update(cart.id, { couponCode: coupon.trim() }))} />
        </Row>
        {p.coupon?.problem ? <P small style={{ color: th.danger }}>{t(`cart.couponProblem.${p.coupon.problem}`)}</P> : null}
        {p.coupon?.applied ? <P small style={{ color: th.success }}>{t('cart.couponApplied', { code: p.coupon.code })}</P> : null}
        <Totals cart={cart} />
        {cart.problems.map((pr) => <P key={pr} small style={{ color: th.danger }}>{t(`cart.problems.${pr}`)}</P>)}
        {err ? <ErrorBox message={err} /> : null}
        <Button title={t('cart.checkout')} disabled={!cart.checkoutReady} onPress={() => router.push('/checkout')} />
        {!cart.requiresShipping ? <P muted small>{t('cart.digitalNote')}</P> : null}
      </Card>
    </Screen>
  );
}
