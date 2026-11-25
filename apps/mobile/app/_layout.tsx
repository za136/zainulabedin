import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import { ErrorBox, Loading, useTheme } from '@/components/ui';
import { AppStateProvider, useApp } from '@/lib/app-state';

function Shell() {
  const { ready, error, store, reload } = useApp();
  const th = useTheme();
  const t = useTranslations();
  if (!ready) return <Loading />;
  if (error || !store)
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <ErrorBox message={t('app.offline')} onRetry={reload} />
      </View>
    );
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: th.primary },
          headerTintColor: th.primaryFg,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: th.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: store.name }} />
        <Stack.Screen name="product/[slug]" options={{ title: '' }} />
        <Stack.Screen name="checkout" options={{ title: t('checkout.title') }} />
        <Stack.Screen name="order/[id]" options={{ title: t('app.orderTitle') }} />
        <Stack.Screen name="diagram/[id]" options={{ title: '3D' }} />
        <Stack.Screen name="legal/[key]" options={{ title: t('app.legal') }} />
        <Stack.Screen name="settings" options={{ title: t('app.settings'), presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <Shell />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
