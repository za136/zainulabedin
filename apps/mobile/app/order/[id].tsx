import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { Button, Card, ErrorBox, H1, KeyValue, Loading, P, Screen, useTheme } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { API_URL } from '@/lib/config';
import { money } from '@/lib/format';
import { useAsync, useErrorText } from '@/lib/hooks';

/** Order confirmation / payment status. Hosts the dev mock payment and Vorkasse instructions. */
export default function OrderScreen() {
  const { id, token } = useLocalSearchParams<{ id: string; token?: string }>();
  const { api, store, locale, user } = useApp();
  const t = useTranslations();
  const th = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { data: o, error, loading, reload, setData } = useAsync(() => api.orders.get(id, token), [api, id, token]);
  useFocusEffect(useCallback(() => reload(), [reload]));

  if (loading && !o) return <Loading />;
  if (error || !o) return <Screen><ErrorBox message={error?.message ?? '404'} onRetry={reload} /></Screen>;

  const paid = o.paymentStatus === 'paid';
  const bank = store!.payments.find((p) => p.id === o.paymentProvider)?.bank;
  const mock = async (outcome: 'success' | 'failure') => {
    setBusy(true);
    setErr(null);
    try {
      const updated = await api.payments.mockConfirm(o.id, token!, outcome);
      setData(updated);
      if (outcome === 'failure') setErr(t('mockPay.failed'));
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={{ fontSize: 44 }}>{paid ? '✅' : '⏳'}</Text>
      <H1>{paid ? t('success.title') : t('success.pending')}</H1>
      <KeyValue rows={[[t('success.number'), o.number], [t('success.amount'), money(o.totals.total, o.currency, locale)], ['Status', t(`account.status.${o.status}`)]]} />
      <P muted>{t('success.email', { email: o.email })}</P>
      {err ? <ErrorBox message={err} /> : null}

      {!paid && o.paymentProvider === 'mock' && token ? (
        <Card>
          <Text style={{ fontWeight: '800', color: th.fg }}>🧪 {t('mockPay.title')}</Text>
          <P muted small>{t('mockPay.text')}</P>
          <Button title={t('mockPay.pay')} loading={busy} onPress={() => mock('success')} />
          <Button title={t('mockPay.fail')} variant="outline" disabled={busy} onPress={() => mock('failure')} />
        </Card>
      ) : null}

      {!paid && bank ? (
        <Card>
          <P>{t('success.bank')}</P>
          <KeyValue rows={[[t('success.accountHolder'), bank.accountHolder], [t('success.iban'), bank.iban.replace(/(.{4})/g, '$1 ')], [t('success.bic'), bank.bic], [t('success.reference'), o.number], [t('success.amount'), money(o.totals.total, o.currency, locale)]]} />
        </Card>
      ) : null}

      {!paid && o.paymentProvider === 'stripe' ? <Button title={t('app.refreshStatus')} variant="outline" onPress={reload} /> : null}

      {paid ? (
        <View style={{ gap: 10 }}>
          {o.items?.some((i) => i.fulfillmentStatus === 'scheduled' && !['service'].includes(i.kind)) ? <P>{t('success.digitalScheduled')}</P> : null}
          <Button title={t('success.invoice')} variant="outline" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/v1/orders/${o.id}/invoice${token ? `?token=${encodeURIComponent(token)}` : ''}`)} />
          {user ? (
            <Button title={t('success.goLibrary')} onPress={() => router.replace('/account')} />
          ) : (
            <>
              <P muted small>{t('success.createAccountText')}</P>
              <Button title={t('success.createAccount')} onPress={() => router.replace(`/account?claimOrder=${o.id}&claimToken=${encodeURIComponent(token ?? '')}`)} />
            </>
          )}
        </View>
      ) : null}
    </Screen>
  );
}
