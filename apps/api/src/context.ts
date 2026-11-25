import type { LoadedStore } from '@factory/config';
import type { Locale, TaxSettings } from '@factory/core';
import type { Database } from '@factory/db';
import type { Env } from './env.js';
import type { Mailer } from './modules/notifications/mailer.js';
import type { PaymentRegistry } from './modules/payments/registry.js';
import type { VatValidator } from './modules/checkout/vat.js';

/**
 * Everything a module needs, passed explicitly (no globals) — which makes every
 * service trivially testable and lets one process host several stores if needed.
 */
export interface AppContext {
  env: Env;
  store: LoadedStore;
  db: Database;
  payments: PaymentRegistry;
  mailer: Mailer;
  vat: VatValidator;
  now(): Date;
}

export function taxSettings(ctx: AppContext): TaxSettings {
  return ctx.store.config.tax;
}

/** Request-scoped market: which language, country and currency to price/translate for. */
export interface Market {
  locale: Locale;
  country: string;
  currency: 'EUR' | 'CHF' | 'USD' | 'GBP';
}

export function defaultMarket(ctx: AppContext): Market {
  const cfg = ctx.store.config;
  const m = cfg.markets.find((x) => x.default) ?? cfg.markets[0]!;
  return { locale: cfg.locales.default, country: m.country, currency: m.currency };
}

export function resolveMarket(ctx: AppContext, input: { locale?: string; country?: string; currency?: string; acceptLanguage?: string }): Market {
  const cfg = ctx.store.config;
  const def = defaultMarket(ctx);
  const supported = cfg.locales.supported;
  let locale = def.locale;
  if (input.locale && supported.includes(input.locale as Locale)) locale = input.locale as Locale;
  else if (input.acceptLanguage) {
    const first = input.acceptLanguage.split(',')[0]?.split(/[-;]/)[0]?.trim().toLowerCase();
    if (first && supported.includes(first as Locale)) locale = first as Locale;
  }
  const country = input.country && /^[A-Z]{2}$/.test(input.country) ? input.country : def.country;
  const market = cfg.markets.find((m) => m.country === country);
  const currencies = new Set(cfg.markets.map((m) => m.currency));
  const currency = input.currency && currencies.has(input.currency as Market['currency']) ? (input.currency as Market['currency']) : market?.currency ?? def.currency;
  return { locale, country, currency };
}
