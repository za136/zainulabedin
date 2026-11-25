import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { ScrollView } from 'react-native';
import { useTranslations } from 'use-intl';
import { MESSAGE_LOCALES, type MessageLocale } from '@factory/i18n';
import { Button, Card, Chip, H2, P, Row, Screen } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { API_URL, WEB_URL } from '@/lib/config';

export default function Settings() {
  const { store, locale, setLocale, country, setCountry } = useApp();
  const t = useTranslations();
  const locales = store!.locales.supported.filter((l): l is MessageLocale => (MESSAGE_LOCALES as string[]).includes(l));
  const countries = [...new Set(store!.markets.map((m) => m.country).concat(store!.shipping.zones.flatMap((z) => z.countries)))];
  return (
    <Screen>
      <Card>
        <H2>{t('app.language')}</H2>
        <Row>{locales.map((l) => <Chip key={l} label={l === 'de' ? 'Deutsch' : 'English'} active={locale === l} onPress={() => setLocale(l)} />)}</Row>
      </Card>
      <Card>
        <H2>{t('app.country')}</H2>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {countries.map((c) => <Chip key={c} label={t.has(`countries.${c}`) ? t(`countries.${c}`) : c} active={country === c} onPress={() => setCountry(c)} />)}
        </ScrollView>
      </Card>
      <Button title={`↗ ${t('app.openWebsite')}`} variant="outline" onPress={() => WebBrowser.openBrowserAsync(WEB_URL)} />
      <P muted small>{store!.name} · {t('app.version')} {Constants.expoConfig?.version} · {API_URL}</P>
    </Screen>
  );
}
