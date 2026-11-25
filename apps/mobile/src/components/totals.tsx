import { Text, View } from 'react-native';
import { useTranslations } from 'use-intl';
import type { Cart } from '@factory/sdk';
import { useApp } from '@/lib/app-state';
import { lt, money } from '@/lib/format';
import { P, useTheme } from './ui';

export function Totals({ cart }: { cart: Cart }) {
  const t = useTranslations('cart');
  const { locale } = useApp();
  const th = useTheme();
  const p = cart.pricing;
  const m = (n: number) => money(n, cart.currency, locale);
  const line = (label: string, value: string, opts: { bold?: boolean; muted?: boolean; color?: string } = {}) => (
    <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ flex: 1, color: opts.color ?? (opts.muted ? th.mutedFg : th.fg), fontWeight: opts.bold ? '800' : '400', fontSize: opts.muted ? 12 : opts.bold ? 17 : 14 }}>{label}</Text>
      <Text style={{ color: opts.color ?? (opts.muted ? th.mutedFg : th.fg), fontWeight: opts.bold ? '800' : '500', fontSize: opts.muted ? 12 : opts.bold ? 17 : 14 }}>{value}</Text>
    </View>
  );
  return (
    <View style={{ gap: 6 }}>
      {line(t('subtotal'), m(p.subtotal))}
      {p.discountTotal > 0 ? line(`${t('discount')} ${p.coupon?.code ?? ''}`, `−${m(p.discountTotal)}`, { color: th.success }) : null}
      {p.shipping.required ? line(`${t('shipping')}${p.shipping.selected ? ` · ${lt(p.shipping.selected.name, locale)}` : ''}`, p.shipping.amount ? m(p.shipping.amount) : t('free')) : null}
      {line(t('total'), m(p.total), { bold: true })}
      {p.taxLines.filter((l) => l.rate > 0).map((l) => line(t('vatIncluded', { rate: `${l.rate / 100} %` }) + (l.country && l.country !== 'DE' ? ` (${l.country})` : ''), m(l.tax), { muted: true }))}
      {p.invoiceNotes.map((n) => <P key={n} muted small>{n}</P>)}
    </View>
  );
}

