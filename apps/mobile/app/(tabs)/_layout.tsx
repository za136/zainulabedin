import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useTranslations } from 'use-intl';
import { useTheme } from '@/components/ui';
import { useApp } from '@/lib/app-state';

const glyph = (g: string) => ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 20, color }}>{g}</Text>;

export default function TabsLayout() {
  const t = useTranslations('app.tabs');
  const th = useTheme();
  const { store, cart } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: th.primary },
        headerTintColor: th.primaryFg,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: th.primary,
        tabBarInactiveTintColor: th.mutedFg,
        tabBarStyle: { backgroundColor: th.bg, borderTopColor: th.border },
        sceneStyle: { backgroundColor: th.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('home'), headerTitle: store?.name, tabBarIcon: glyph('⌂') }} />
      <Tabs.Screen name="catalog" options={{ title: t('catalog'), tabBarIcon: glyph('⌕') }} />
      <Tabs.Screen name="cart" options={{ title: t('cart'), tabBarIcon: glyph('🛍'), tabBarBadge: cart?.itemCount ? cart.itemCount : undefined, tabBarBadgeStyle: { backgroundColor: th.accent, color: th.accentFg } }} />
      <Tabs.Screen name="account" options={{ title: t('account'), tabBarIcon: glyph('◉') }} />
    </Tabs>
  );
}
