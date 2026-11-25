import { useLocalSearchParams } from 'expo-router';
import { createElement } from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Loading, useTheme } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { webUrl } from '@/lib/config';

/**
 * 3D diagrams reuse the website's three.js viewer (one implementation, every platform):
 * native → WebView on /embed/diagram/<id> with the session as Authorization header,
 * web    → iframe (public previews; owned diagrams open on the website).
 */
export default function DiagramScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, locale, store } = useApp();
  const th = useTheme();
  const uri = webUrl(`/embed/diagram/${encodeURIComponent(id)}`, locale, store!.locales.default);
  if (Platform.OS === 'web') {
    return <View style={{ flex: 1, backgroundColor: '#000' }}>{createElement('iframe', { src: uri, title: id, style: { border: 0, width: '100%', height: '100%' }, allow: 'fullscreen' })}</View>;
  }
  return (
    <WebView
      source={{ uri, headers: token ? { Authorization: `Bearer ${token}` } : {} }}
      style={{ flex: 1, backgroundColor: th.bg }}
      startInLoadingState
      renderLoading={() => <Loading />}
      allowsFullscreenVideo
      setSupportMultipleWindows={false}
    />
  );
}
