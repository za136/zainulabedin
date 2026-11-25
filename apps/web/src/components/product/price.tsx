import { useLocale, useTranslations } from 'next-intl';
import type { PriceView } from '@factory/sdk';
import { money, pct } from '@/lib/format';

/**
 * PAngV-compliant price display: gross price, VAT note, shipping note, unit price
 * (Grundpreis) and an honest reference price.
 */
export function Price({ price, from, size = 'md', className = '' }: { price: PriceView | null; from?: boolean; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const locale = useLocale();
  const t = useTranslations('product');
  if (!price) return null;
  const cls = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-lg';
  return (
    <div className={className}>
      <span className={`${cls} font-semibold tabular-nums`}>
        {from && <span className="mr-1 text-sm font-normal text-muted-foreground">{t('from')}</span>}
        {money(price.amount, price.currency, locale)}
      </span>
      {price.compareAt && price.compareAt > price.amount && <span className="ml-2 text-sm text-muted-foreground line-through">{t('compareAt', { price: money(price.compareAt, price.currency, locale) })}</span>}
      {price.unitPrice && <span className="ml-2 text-xs text-muted-foreground">({t('unitPrice', { price: money(price.unitPrice.amount, price.currency, locale), per: price.unitPrice.per })})</span>}
    </div>
  );
}

export function VatNote({ rate, treatment, requiresShipping }: { rate: number; treatment: string; requiresShipping: boolean }) {
  const locale = useLocale();
  const t = useTranslations('product');
  const vat = treatment === 'export' || treatment === 'reverse_charge' ? t('exportNet') : treatment === 'small_business' ? '' : t('inclVat', { rate: pct(rate, locale) });
  return (
    <p className="text-xs text-muted-foreground">
      {vat}
      {vat && ', '}
      <a href={locale === 'de' ? '/legal/versand-zahlung' : '/en/legal/shipping-payment'} className="underline">
        {requiresShipping ? t('plusShipping') : t('noShipping')}
      </a>
    </p>
  );
}
