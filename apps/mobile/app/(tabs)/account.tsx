import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import type { LibraryItem, Order, Subscription } from '@factory/sdk';
import { Button, Card, Check, Chip, ErrorBox, Field, H1, H2, Loading, P, ProductArt, Row, Screen, useTheme } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { dateTime, lt, money } from '@/lib/format';
import { useAsync, useErrorText } from '@/lib/hooks';

export default function Account() {
  const { user } = useApp();
  return user ? <Dashboard /> : <AuthForm />;
}

function AuthForm() {
  const { api, signIn, locale } = useApp();
  const params = useLocalSearchParams<{ claimOrder?: string; claimToken?: string }>();
  const claim = params.claimOrder && params.claimToken ? { orderId: params.claimOrder, token: params.claimToken } : undefined;
  const t = useTranslations();
  const router = useRouter();
  const errorText = useErrorText();
  const [mode, setMode] = useState<'login' | 'register'>(claim ? 'register' : 'login');
  const [f, setF] = useState({ email: '', password: '', firstName: '', lastName: '', marketing: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = mode === 'login'
        ? await api.auth.login({ email: f.email.trim(), password: f.password, claim })
        : await api.auth.register({ email: f.email.trim(), password: f.password, firstName: f.firstName || undefined, lastName: f.lastName || undefined, marketingConsent: f.marketing, locale, claim });
      signIn(res.token, res.customer);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <H1>{t('account.title')}</H1>
      <Row>
        <Chip label={t('account.login')} active={mode === 'login'} onPress={() => setMode('login')} />
        <Chip label={t('account.register')} active={mode === 'register'} onPress={() => setMode('register')} />
      </Row>
      <Card>
        {mode === 'register' ? (
          <Row style={{ alignItems: 'flex-start' }}>
            <Field label={t('account.firstName')} value={f.firstName} onChangeText={(v) => setF({ ...f, firstName: v })} />
            <Field label={t('account.lastName')} value={f.lastName} onChangeText={(v) => setF({ ...f, lastName: v })} />
          </Row>
        ) : null}
        <Field label={t('account.email')} value={f.email} onChangeText={(v) => setF({ ...f, email: v })} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label={t('account.password')} value={f.password} onChangeText={(v) => setF({ ...f, password: v })} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        {mode === 'register' ? <Check label={t('account.marketing')} value={f.marketing} onChange={(v) => setF({ ...f, marketing: v })} /> : null}
        {err ? <ErrorBox message={err} /> : null}
        <Button title={t(`account.${mode}`)} onPress={submit} loading={busy} disabled={!f.email || !f.password} />
      </Card>
      <Footer onSettings={() => router.push('/settings')} />
    </Screen>
  );
}

function Footer({ onSettings }: { onSettings: () => void }) {
  const t = useTranslations();
  const router = useRouter();
  const th = useTheme();
  return (
    <View style={{ gap: 10, marginTop: 8 }}>
      <Button title={`⚙︎ ${t('app.settings')}`} variant="outline" onPress={onSettings} />
      <Row>
        {(['imprint', 'terms', 'withdrawal', 'privacy', 'shipping'] as const).map((k) => (
          <Text key={k} accessibilityRole="link" onPress={() => router.push(`/legal/${k}`)} style={{ color: th.mutedFg, textDecorationLine: 'underline', fontSize: 13 }}>{t(`footer.${k}`)}</Text>
        ))}
      </Row>
    </View>
  );
}

function Dashboard() {
  const { api, user, signOut, locale } = useApp();
  const t = useTranslations();
  const router = useRouter();
  const lib = useAsync(() => api.me.library(), [api]);
  const orders = useAsync(() => api.me.orders(), [api]);
  const subs = useAsync(() => api.me.subscriptions(), [api]);
  useFocusEffect(
    useCallback(() => {
      lib.reload();
      orders.reload();
      subs.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [api]),
  );
  const titles = Object.fromEntries((lib.data?.items ?? []).filter((i) => i.product).map((i) => [i.product!.id, i.product!.title]));
  return (
    <Screen>
      <H1>{t('account.hello', { name: user!.firstName ?? user!.email })}</H1>
      <H2>{t('account.library')}</H2>
      {lib.loading && !lib.data ? <Loading /> : lib.error ? <ErrorBox message={lib.error.message} onRetry={lib.reload} /> : lib.data!.items.length === 0 ? <P muted>{t('account.noLibrary')}</P> : (
        lib.data!.items.filter((i) => i.type !== 'subscription' || i.grantsAccessTo.length).map((it) => <LibraryCard key={it.id} item={it} />)
      )}
      {subs.data?.subscriptions.length ? (
        <>
          <H2>{t('account.subscriptions')}</H2>
          {subs.data.subscriptions.map((s) => <SubscriptionCard key={s.id} sub={s} title={titles[s.productId] ?? ''} onChanged={subs.reload} />)}
        </>
      ) : null}
      <H2>{t('account.orders')}</H2>
      {orders.data?.orders.length ? orders.data.orders.map((o: Order) => (
        <Pressable key={o.id} accessibilityRole="link" onPress={() => router.push(`/order/${o.id}`)}>
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontWeight: '700' }}>{o.number}</Text>
              <P muted small>{dateTime(o.placedAt, locale, { dateStyle: 'medium' })} · {t(`account.status.${o.status}`)}</P>
            </View>
            <Text style={{ fontWeight: '800' }}>{money(o.totals.total, o.currency, locale)}</Text>
          </Card>
        </Pressable>
      )) : <P muted>{t('account.noOrders')}</P>}
      <Button title={t('nav.logout')} variant="outline" onPress={signOut} />
      <Footer onSettings={() => router.push('/settings')} />
    </Screen>
  );
}

function LibraryCard({ item }: { item: LibraryItem }) {
  const { api, locale } = useApp();
  const t = useTranslations();
  const th = useTheme();
  const router = useRouter();
  const [done, setDone] = useState(item.course?.completed ?? []);
  const [copied, setCopied] = useState<string | null>(null);
  const p = item.product;
  return (
    <Card style={{ flexDirection: 'row', gap: 12 }}>
      {p ? <View style={{ width: 70 }}><ProductArt slug={p.slug} kind={p.kind} title={p.title} compact /></View> : null}
      <View style={{ flex: 1, gap: 8 }}>
        {p ? <Text style={{ fontWeight: '800', color: th.fg }}>{p.title}</Text> : null}
        {!item.available ? <P small style={{ color: th.accentFg }}>{t('account.availableFrom', { date: dateTime(item.startsAt, locale, { dateStyle: 'medium' }) })}</P> : null}
        {item.files.filter((f) => f.url).length ? (
          <Row>{item.files.filter((f) => f.url).map((f) => <Chip key={f.key} label={`⬇ ${f.format?.toUpperCase() ?? f.name}`} onPress={() => WebBrowser.openBrowserAsync(f.url!)} />)}</Row>
        ) : null}
        {item.available && item.diagrams.length ? <Row>{item.diagrams.map((d) => <Chip key={d} label={`🧊 ${t('account.open3d')}`} onPress={() => router.push(`/diagram/${d}`)} />)}</Row> : null}
        {item.licenseKeys.map((k) => (
          <Pressable key={k} accessibilityRole="button" accessibilityLabel={`${t('app.copy')} ${k}`} onPress={async () => { await Clipboard.setStringAsync(k); setCopied(k); }}>
            <Text style={{ fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), backgroundColor: th.muted, padding: 8, borderRadius: 6, color: th.fg }}>{k}  {copied === k ? `✓ ${t('app.copied')}` : '⧉'}</Text>
          </Pressable>
        ))}
        {item.course ? item.course.modules.flatMap((m) => m.lessons).map((l) => (
          <Check key={l.id} label={lt(l.title, locale)} value={done.includes(l.id)} onChange={async () => {
            if (done.includes(l.id) || !item.available) return;
            await api.me.completeLesson(item.id, l.id);
            setDone([...done, l.id]);
          }} />
        )) : null}
        {item.grantsAccessTo.map((g) => <Text key={g.id} accessibilityRole="link" style={{ color: th.primary }} onPress={() => router.push(`/product/${g.slug}`)}>• {g.title}</Text>)}
      </View>
    </Card>
  );
}

/** § 312k BGB cancellation button. */
function SubscriptionCard({ sub, title, onChanged }: { sub: Subscription; title: string; onChanged: () => void }) {
  const { api, locale } = useApp();
  const t = useTranslations();
  const cancel = () => {
    const go = async () => {
      await api.me.cancelSubscription(sub.id);
      onChanged();
    };
    if (Platform.OS === 'web') return void go();
    Alert.alert(t('app.confirmCancelTitle'), t('app.confirmCancelText'), [{ text: t('app.keep'), style: 'cancel' }, { text: t('account.cancelConfirm'), style: 'destructive', onPress: go }]);
  };
  return (
    <Card>
      <Text style={{ fontWeight: '800' }}>{title}</Text>
      <P muted small>
        {money(sub.amount, sub.currency, locale)} / {t(`product.per.${sub.billing.interval}`)} ·{' '}
        {sub.status === 'expired' ? t('account.status.cancelled') : sub.cancelAtPeriodEnd ? t('account.cancelled', { date: dateTime(sub.currentPeriodEnd, locale, { dateStyle: 'medium' }) }) : t('account.renews', { date: dateTime(sub.currentPeriodEnd, locale, { dateStyle: 'medium' }) })}
      </P>
      {sub.status === 'active' && !sub.cancelAtPeriodEnd ? <Button title={t('account.cancelSub')} variant="danger" onPress={cancel} /> : null}
    </Card>
  );
}
