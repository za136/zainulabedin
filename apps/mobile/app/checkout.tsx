import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import type { Address } from '@factory/sdk';
import { Button, Card, Check, Chip, ErrorBox, Field, H2, P, Row, Screen, useTheme } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { lt, money } from '@/lib/format';
import { useErrorText } from '@/lib/hooks';
import { Totals } from '@/components/totals';
import { createClient } from '@factory/sdk';
import { API_URL } from '@/lib/config';

const empty: Address = { firstName: '', lastName: '', company: '', street: '', zip: '', city: '', country: 'DE' };

/** Native checkout — same legal elements as the website (consents from the API, § 312j button). */
export default function Checkout() {
  const { cart, api, user, store, locale, setCart, signIn } = useApp();
  const t = useTranslations();
  const th = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const [email, setEmail] = useState(user?.email ?? '');
  const [addr, setAddr] = useState<Address>({ ...empty, country: cart?.country ?? 'DE', firstName: user?.firstName ?? '', lastName: user?.lastName ?? '' });
  const [b2b, setB2b] = useState(false);
  const [vatId, setVatId] = useState('');
  const [provider, setProvider] = useState(store!.payments[0]?.id ?? '');
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!cart) return <Screen><P>{t('cart.empty')}</P></Screen>;

  const countries = [...new Set(store!.shipping.zones.flatMap((z) => z.countries).concat(store!.markets.map((m) => m.country)))];
  const set = (k: keyof Address) => (v: string) => setAddr({ ...addr, [k]: v });
  const missingRequired = cart.consents.some((c) => c.required && !consents[c.key]);
  const valid = /.+@.+\..+/.test(email) && addr.firstName && addr.lastName && addr.street && addr.zip && addr.city && !missingRequired;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await api.checkout({
        cartId: cart.id,
        email: email.trim(),
        billingAddress: { ...addr, company: addr.company || undefined },
        customerType: b2b ? 'b2b' : 'b2c',
        vatId: b2b && vatId ? vatId : undefined,
        consents: { terms: !!consents.terms, digital_waiver: !!consents.digital_waiver, service_early_start: !!consents.service_early_start },
        paymentProvider: provider,
        createAccountPassword: password.length >= 10 ? password : undefined,
      });
      setCart(null);
      if (res.session) {
        // the account was created during checkout — adopt its session
        const me = await createClient({ baseUrl: API_URL, token: res.session.token }).me.get().catch(() => null);
        if (me) signIn(res.session.token, me.customer);
      }
      const q = `token=${encodeURIComponent(res.accessToken)}`;
      if (res.payment.type === 'redirect' && provider !== 'mock') await WebBrowser.openBrowserAsync(res.payment.url);
      router.replace(`/order/${res.orderId}?${q}`);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {err ? <ErrorBox message={err} /> : null}
      <Card>
        <H2>{t('checkout.contact')}</H2>
        <Field label={t('checkout.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
      </Card>
      <Card>
        <H2>{t('checkout.billing')}</H2>
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={t('checkout.firstName')} value={addr.firstName} onChangeText={set('firstName')} autoComplete="given-name" />
          <Field label={t('checkout.lastName')} value={addr.lastName} onChangeText={set('lastName')} autoComplete="family-name" />
        </Row>
        <Field label={t('checkout.company')} value={addr.company} onChangeText={set('company')} />
        <Field label={t('checkout.street')} value={addr.street} onChangeText={set('street')} autoComplete="street-address" />
        <Row style={{ alignItems: 'flex-start' }}>
          <Field label={t('checkout.zip')} value={addr.zip} onChangeText={set('zip')} keyboardType="number-pad" autoComplete="postal-code" />
          <Field label={t('checkout.city')} value={addr.city} onChangeText={set('city')} />
        </Row>
        <Text style={{ fontWeight: '600', color: th.fg }}>{t('checkout.country')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {countries.map((c) => <Chip key={c} label={t.has(`countries.${c}`) ? t(`countries.${c}`) : c} active={addr.country === c} onPress={() => setAddr({ ...addr, country: c })} />)}
        </ScrollView>
        {store!.features.b2b ? (
          <View style={{ gap: 8 }}>
            <Row>
              <Switch value={b2b} onValueChange={setB2b} accessibilityLabel={t('checkout.b2b')} trackColor={{ true: th.primary }} />
              <P>{t('checkout.b2b')}</P>
            </Row>
            {b2b ? <Field label={t('checkout.vatId')} value={vatId} onChangeText={setVatId} autoCapitalize="characters" placeholder="ATU12345678" /> : null}
          </View>
        ) : null}
      </Card>
      <Card>
        <H2>{t('checkout.payment')}</H2>
        {store!.payments.map((p) => (
          <Check key={p.id} label={`${lt(p.label, locale)} — ${p.methods.map((m) => (t.has(`checkout.methods.${m}`) ? t(`checkout.methods.${m}`) : m)).join(', ')}`} value={provider === p.id} onChange={() => setProvider(p.id)} />
        ))}
      </Card>
      <Card>
        <H2>{t('checkout.createAccount')}</H2>
        <Field label={t('checkout.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      </Card>
      <Card>
        <H2>{t('checkout.summary')}</H2>
        {cart.items.map((i) => <P key={i.id} small>{i.quantity} × {i.title} — {money(i.pricing?.total ?? 0, cart.currency, locale)}</P>)}
        <Totals cart={cart} />
      </Card>
      <Card>
        {cart.consents.map((c) => (
          <View key={c.key} style={{ gap: 4 }}>
            <Check label={lt(c.label, locale) + (c.required ? ' *' : '')} value={!!consents[c.key]} onChange={(v) => setConsents({ ...consents, [c.key]: v })} />
            {c.key === 'digital_waiver' ? <P muted small>{t('checkout.waiverHint')}</P> : null}
          </View>
        ))}
        <Row>
          {(['terms', 'withdrawal', 'privacy'] as const).map((k) => (
            <Text key={k} accessibilityRole="link" style={{ color: th.primary, textDecorationLine: 'underline', fontSize: 13 }} onPress={() => router.push(`/legal/${k}`)}>{t(`footer.${k}`)}</Text>
          ))}
        </Row>
      </Card>
      {/* § 312j Abs. 3 BGB order button */}
      <Button title={lt(store!.orderButtonLabel, locale)} onPress={submit} loading={busy} disabled={!valid || !cart.checkoutReady} />
      <P muted small style={{ textAlign: 'center' }}>🔒 {t('checkout.secure')}</P>
    </Screen>
  );
}
