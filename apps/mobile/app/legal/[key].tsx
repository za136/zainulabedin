import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { ErrorBox, H1, H2, Loading, P, Screen, useTheme } from '@/components/ui';
import { useApp } from '@/lib/app-state';
import { useAsync } from '@/lib/hooks';

/** Legal pages from the store folder (same Markdown as the website), rendered natively. */
export default function LegalScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { api } = useApp();
  const { data, error, loading, reload } = useAsync(() => api.content(key), [api, key]);
  if (loading) return <Loading />;
  if (error || !data) return <Screen><ErrorBox message={error?.message ?? '404'} onRetry={reload} /></Screen>;
  return <Screen><Markdown source={data.markdown} /></Screen>;
}

function Inline({ text }: { text: string }) {
  // **bold** and [label](url) → label
  const parts = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith('**') ? <Text key={i} style={{ fontWeight: '700' }}>{p.slice(2, -2)}</Text> : <Text key={i}>{p}</Text>))}</>;
}

function Markdown({ source }: { source: string }) {
  const th = useTheme();
  const blocks = source.split(/\n{2,}/);
  return (
    <View style={{ gap: 12 }}>
      {blocks.map((b, i) => {
        const block = b.trim();
        if (block.startsWith('# ')) return <H1 key={i}>{block.slice(2)}</H1>;
        if (block.startsWith('## ')) return <H2 key={i}>{block.slice(3)}</H2>;
        if (block.startsWith('> ')) return <View key={i} style={{ borderLeftWidth: 4, borderColor: th.accent, backgroundColor: th.muted, padding: 10 }}><P small><Inline text={block.slice(2)} /></P></View>;
        if (/^[-*] /m.test(block)) return <View key={i} style={{ gap: 4 }}>{block.split('\n').map((l, j) => <P key={j}>• <Inline text={l.replace(/^[-*] /, '')} /></P>)}</View>;
        return <P key={i}><Inline text={block} /></P>;
      })}
    </View>
  );
}
