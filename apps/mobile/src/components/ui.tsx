import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import type { PriceView, ProductCard as Card } from '@factory/sdk';
import { useApp } from '@/lib/app-state';
import { money } from '@/lib/format';

/** Brand palette from store.json → theme.colors (falls back to neutral defaults while loading). */
export function useTheme() {
  const { store } = useApp();
  const c = store?.theme.colors;
  return {
    bg: c?.background ?? '#ffffff',
    fg: c?.foreground ?? '#0f172a',
    muted: c?.muted ?? '#f1f5f9',
    mutedFg: c?.mutedForeground ?? '#64748b',
    border: c?.border ?? '#e2e8f0',
    primary: c?.primary ?? '#1e3a8a',
    primaryFg: c?.primaryForeground ?? '#ffffff',
    accent: c?.accent ?? '#f59e0b',
    accentFg: c?.accentForeground ?? '#1f2937',
    success: c?.success ?? '#15803d',
    danger: c?.danger ?? '#b91c1c',
    radius: parseFloat(store?.theme.radius ?? '0.75') * 16,
  };
}

export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

export function Screen({ children, scroll = true, padded = true, refresh }: { children: ReactNode; scroll?: boolean; padded?: boolean; refresh?: ReactNode }) {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const inner = <View style={[padded && { padding: 16 }, { paddingBottom: 32 + insets.bottom, gap: 16, maxWidth: 1100, width: '100%', alignSelf: 'center' }]}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      {refresh}
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </View>
  );
}

export function H1({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const th = useTheme();
  return <Text accessibilityRole="header" style={[{ fontFamily: serif, fontSize: 30, fontWeight: '700', color: th.fg, letterSpacing: -0.4 }, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const th = useTheme();
  return <Text accessibilityRole="header" style={[{ fontFamily: serif, fontSize: 21, fontWeight: '700', color: th.fg }, style]}>{children}</Text>;
}
export function P({ children, muted, small, style }: { children: ReactNode; muted?: boolean; small?: boolean; style?: StyleProp<TextStyle> }) {
  const th = useTheme();
  return <Text style={[{ color: muted ? th.mutedFg : th.fg, fontSize: small ? 12.5 : 15, lineHeight: small ? 18 : 22 }, style]}>{children}</Text>;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style, icon, color }: { title: string; onPress?: () => void; variant?: 'primary' | 'outline' | 'accent' | 'danger' | 'ghost'; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; icon?: string; /** text colour override (e.g. on dark heroes) */ color?: string }) {
  const th = useTheme();
  const bg = { primary: th.primary, accent: th.accent, danger: th.danger, outline: 'transparent', ghost: 'transparent' }[variant];
  const fg = color ?? { primary: th.primaryFg, accent: th.accentFg, danger: '#fff', outline: th.fg, ghost: th.fg }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading }}
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        { backgroundColor: bg, borderRadius: th.radius, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        variant === 'outline' && { borderWidth: 1, borderColor: th.border },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{icon ? `${icon}  ` : ''}{title}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const th = useTheme();
  return <View style={[{ borderWidth: 1, borderColor: th.border, borderRadius: th.radius, padding: 16, backgroundColor: th.bg, gap: 10 }, style]}>{children}</View>;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const th = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress} style={{ borderWidth: 1, borderColor: active ? th.primary : th.border, backgroundColor: active ? th.primary : th.bg, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
      <Text style={{ color: active ? th.primaryFg : th.fg, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const th = useTheme();
  return (
    <View style={{ gap: 4, flex: 1, minWidth: 140 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: th.fg }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={th.mutedFg}
        style={{ borderWidth: 1, borderColor: error ? th.danger : th.border, borderRadius: th.radius * 0.6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: th.fg, backgroundColor: th.bg }}
        {...props}
      />
      {error ? <Text style={{ color: th.danger, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

export function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const th = useTheme();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} accessibilityLabel={label} onPress={() => onChange(!value)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: value ? th.primary : th.border, backgroundColor: value ? th.primary : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {value ? <Text style={{ color: th.primaryFg, fontWeight: '900', fontSize: 13 }}>✓</Text> : null}
      </View>
      <Text style={{ flex: 1, color: th.fg, fontSize: 13.5, lineHeight: 19 }}>{label}</Text>
    </Pressable>
  );
}

export function Loading() {
  const th = useTheme();
  return (
    <View style={{ padding: 40, alignItems: 'center' }}>
      <ActivityIndicator color={th.primary} size="large" />
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const th = useTheme();
  const t = useTranslations('app');
  return (
    <Card style={{ borderColor: th.danger }}>
      <P style={{ color: th.danger }}>{message}</P>
      {onRetry ? <Button title={t('retry')} variant="outline" onPress={onRetry} /> : null}
    </Card>
  );
}

export function Price({ price, from, size = 17 }: { price: PriceView | null; from?: boolean; size?: number }) {
  const { locale } = useApp();
  const th = useTheme();
  const t = useTranslations('product');
  if (!price) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
      {from ? <Text style={{ color: th.mutedFg, fontSize: 12 }}>{t('from')}</Text> : null}
      <Text style={{ fontSize: size, fontWeight: '700', color: th.fg }}>{money(price.amount, price.currency, locale)}</Text>
      {price.compareAt && price.compareAt > price.amount ? <Text style={{ color: th.mutedFg, fontSize: 12, textDecorationLine: 'line-through' }}>{money(price.compareAt, price.currency, locale)}</Text> : null}
    </View>
  );
}

const PALETTES: [string, string][] = [
  ['#1d2b6b', '#f2a93b'], ['#7c2d12', '#fde68a'], ['#064e3b', '#a7f3d0'], ['#3b0764', '#f0abfc'],
  ['#0f172a', '#38bdf8'], ['#831843', '#fbcfe8'], ['#1e3a8a', '#93c5fd'], ['#422006', '#fcd34d'],
];
const KIND_GLYPH: Record<string, string> = { physical: '🎧', book: '📖', ebook: '📱', interactive_book: '🧊', digital_download: '⬇️', license: '🔑', subscription: '♾️', course: '🎓', service: '📅' };
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Native counterpart of the web's generative product art (same palette & hashing → same colours). */
export function ProductArt({ slug, kind, title, authors = [], compact }: { slug: string; kind: string; title: string; authors?: string[]; compact?: boolean }) {
  const [bg, fg] = PALETTES[hash(slug.replace(/-(ebook|3d)$/, '')) % PALETTES.length]!;
  const isBook = kind === 'book' || kind === 'ebook' || kind === 'interactive_book';
  return (
    <View accessible={false} style={[styles.art, { backgroundColor: bg }]}>
      {isBook ? <View style={styles.spine} /> : null}
      <Text style={{ fontSize: compact ? 20 : 28 }}>{KIND_GLYPH[kind] ?? '🛍️'}</Text>
      {!compact ? (
        <View>
          <View style={{ width: 28, height: 4, backgroundColor: fg, marginBottom: 8 }} />
          <Text numberOfLines={4} style={{ color: '#fff', fontFamily: serif, fontWeight: '700', fontSize: 17, lineHeight: 21 }}>{title.replace(/ \(E-Book\)$/, '')}</Text>
          {authors[0] ? <Text numberOfLines={1} style={{ color: fg, fontSize: 10, fontWeight: '700', marginTop: 6, letterSpacing: 0.8 }}>{authors.join(' · ').toUpperCase()}</Text> : null}
        </View>
      ) : null}
      {kind === 'ebook' || kind === 'interactive_book' ? (
        <View style={styles.badge}><Text style={{ fontSize: 9, fontWeight: '800' }}>{kind === 'ebook' ? 'E-BOOK' : '3D'}</Text></View>
      ) : null}
    </View>
  );
}

export function ProductCard({ product, width }: { product: Card; width: number }) {
  const router = useRouter();
  const t = useTranslations();
  const th = useTheme();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={product.title} onPress={() => router.push(`/product/${product.slug}`)} style={({ pressed }) => ({ width, gap: 6, opacity: pressed ? 0.8 : 1 })}>
      <ProductArt slug={product.slug} kind={product.kind} title={product.title} authors={product.authors} />
      <Text style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8, color: th.mutedFg, textTransform: 'uppercase' }}>{t(`kinds.${product.kind}`)}</Text>
      <Text numberOfLines={2} style={{ fontFamily: serif, fontSize: 15, fontWeight: '700', color: th.fg }}>{product.title}</Text>
      <Price price={product.price} from={product.priceVaries} size={15} />
    </Pressable>
  );
}

/** Responsive grid: 2 columns on phones, more on tablets / desktop web. */
export function ProductGrid({ products, containerWidth }: { products: Card[]; containerWidth: number }) {
  const cols = containerWidth > 1000 ? 5 : containerWidth > 760 ? 4 : containerWidth > 520 ? 3 : 2;
  const gap = 14;
  const w = Math.floor((Math.min(containerWidth, 1100) - 32 - gap * (cols - 1)) / cols);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, rowGap: 22 }}>
      {products.map((p) => <ProductCard key={p.id} product={p} width={w} />)}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, style]}>{children}</View>;
}

export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  const th = useTheme();
  const visible = rows.filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!visible.length) return null;
  return (
    <View style={{ borderWidth: 1, borderColor: th.border, borderRadius: th.radius }}>
      {visible.map(([k, v], i) => (
        <View key={k} style={{ flexDirection: 'row', padding: 10, gap: 12, borderTopWidth: i ? 1 : 0, borderColor: th.border }}>
          <Text style={{ width: 120, color: th.mutedFg, fontSize: 13 }}>{k}</Text>
          <Text style={{ flex: 1, color: th.fg, fontSize: 13 }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  art: { aspectRatio: 3 / 4, width: '100%', borderRadius: 12, padding: 14, justifyContent: 'space-between', overflow: 'hidden' },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, backgroundColor: 'rgba(0,0,0,0.2)' },
  badge: { position: 'absolute', right: 8, top: 8, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
});
