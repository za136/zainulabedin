import { z } from 'zod';
import { roundHalfUp, type BasisPoints } from './money.js';

/**
 * Tax categories. Every product (or variant) carries one; the rate is resolved
 * per destination country at checkout.
 *
 * - standard          Regelsteuersatz
 * - reduced           ermäßigter Satz (generic reduced goods)
 * - books             printed books (DE 7 %, AT 10 %, CH 2.6 %)
 * - ebooks            electronic publications (DE 7 % since 2019, AT 10 % since 2020, CH 2.6 % since 2025)
 * - digital_services  electronically supplied services (courses, SaaS, licences) — always destination rate in EU (OSS)
 * - services          services supplied at the seller's place (consulting B2C) — origin rate
 * - exempt            no VAT (e.g. certain education services) — use with care
 */
export const TAX_CATEGORIES = ['standard', 'reduced', 'books', 'ebooks', 'digital_services', 'services', 'exempt'] as const;
export type TaxCategory = (typeof TAX_CATEGORIES)[number];
export const taxCategorySchema = z.enum(TAX_CATEGORIES);

export const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE',
  'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
] as const;
export type CountryCode = string; // ISO 3166-1 alpha-2

export function isEU(country: CountryCode): boolean {
  return (EU_COUNTRIES as readonly string[]).includes(country);
}

type RateTable = Partial<Record<Exclude<TaxCategory, 'exempt'>, BasisPoints>> & { standard: BasisPoints };

/**
 * VAT rates in basis points (as of 2026). DACH rates are maintained precisely;
 * for other EU countries the standard rate is maintained and reduced rates for
 * books/e-books where widely known. Missing categories fall back to `standard`
 * and are flagged with `source: 'fallback'` so you can audit them.
 *
 * ⚠️ Tax law changes. Verify with your Steuerberater before going live and
 * override per store in `store.json → tax.rateOverrides`.
 */
export const VAT_RATES: Record<CountryCode, RateTable> = {
  DE: { standard: 1900, reduced: 700, books: 700, ebooks: 700, digital_services: 1900, services: 1900 },
  AT: { standard: 2000, reduced: 1000, books: 1000, ebooks: 1000, digital_services: 2000, services: 2000 },
  CH: { standard: 810, reduced: 260, books: 260, ebooks: 260, digital_services: 810, services: 810 },
  LI: { standard: 810, reduced: 260, books: 260, ebooks: 260, digital_services: 810, services: 810 },
  BE: { standard: 2100, books: 600, ebooks: 600 },
  BG: { standard: 2000, books: 900, ebooks: 900 },
  CY: { standard: 1900, books: 500, ebooks: 500 },
  CZ: { standard: 2100, books: 0, ebooks: 0 },
  DK: { standard: 2500, books: 2500, ebooks: 2500 },
  EE: { standard: 2400, books: 900, ebooks: 900 },
  ES: { standard: 2100, books: 400, ebooks: 400 },
  FI: { standard: 2550, books: 1400, ebooks: 1400 },
  FR: { standard: 2000, books: 550, ebooks: 550 },
  GR: { standard: 2400, books: 600, ebooks: 600 },
  HR: { standard: 2500, books: 500, ebooks: 500 },
  HU: { standard: 2700, books: 500, ebooks: 500 },
  IE: { standard: 2300, books: 0, ebooks: 0 },
  IT: { standard: 2200, books: 400, ebooks: 400 },
  LT: { standard: 2100, books: 900, ebooks: 900 },
  LU: { standard: 1700, books: 300, ebooks: 300 },
  LV: { standard: 2100, books: 1200, ebooks: 1200 },
  MT: { standard: 1800, books: 500, ebooks: 500 },
  NL: { standard: 2100, books: 900, ebooks: 900 },
  PL: { standard: 2300, books: 500, ebooks: 500 },
  PT: { standard: 2300, books: 600, ebooks: 600 },
  RO: { standard: 2100, books: 1100, ebooks: 1100 },
  SE: { standard: 2500, books: 600, ebooks: 600 },
  SI: { standard: 2200, books: 500, ebooks: 500 },
  SK: { standard: 2300, books: 500, ebooks: 500 },
};

export interface TaxSettings {
  /** Country the seller is established in (place of dispatch). */
  originCountry: CountryCode;
  /** EU One-Stop-Shop registration → charge destination VAT for EU B2C distance sales & digital services. */
  oss: boolean;
  /** Additional non-EU VAT registrations (e.g. 'CH' for Swiss MWST) → charge that country's VAT. */
  registrations: CountryCode[];
  /** §19 UStG Kleinunternehmerregelung: no VAT is charged at all. */
  smallBusiness: boolean;
  /** How stored (gross, origin-country) prices behave for other countries. */
  priceStrategy: 'gross-constant' | 'net-constant';
  rateOverrides?: Record<CountryCode, Partial<RateTable>>;
}

export type TaxTreatment =
  | 'domestic'
  | 'oss_destination'
  | 'origin_rate'
  | 'registered_destination'
  | 'reverse_charge'
  | 'export'
  | 'small_business'
  | 'exempt';

export interface TaxResolution {
  rate: BasisPoints;
  treatment: TaxTreatment;
  /** Country whose VAT law applies (undefined when no VAT is charged). */
  taxCountry?: CountryCode;
  source: 'table' | 'override' | 'fallback' | 'none';
  /** Legal note to print on the invoice, e.g. reverse-charge wording. */
  invoiceNote?: string;
}

export interface TaxContext {
  destinationCountry: CountryCode;
  customerType: 'b2c' | 'b2b';
  /** Validated EU VAT ID of a B2B customer (validation via VIES happens outside the core). */
  vatIdValid?: boolean;
}

export function lookupRate(country: CountryCode, category: TaxCategory, settings: Pick<TaxSettings, 'rateOverrides'>): { rate: BasisPoints; source: TaxResolution['source'] } {
  if (category === 'exempt') return { rate: 0, source: 'table' };
  const override = settings.rateOverrides?.[country]?.[category];
  if (override !== undefined) return { rate: override, source: 'override' };
  const table = VAT_RATES[country];
  if (!table) return { rate: 0, source: 'none' };
  const v = table[category];
  if (v !== undefined) return { rate: v, source: 'table' };
  // services / digital services default to the standard rate; that's not a guess.
  if (category === 'services' || category === 'digital_services') return { rate: table.standard, source: 'table' };
  return { rate: table.standard, source: 'fallback' };
}

/**
 * Determine which VAT rate applies to a line. Encodes the main EU place-of-supply
 * rules relevant for a DACH online shop.
 */
export function resolveTax(category: TaxCategory, ctx: TaxContext, settings: TaxSettings): TaxResolution {
  const origin = settings.originCountry;
  const dest = ctx.destinationCountry;

  if (settings.smallBusiness) {
    return { rate: 0, treatment: 'small_business', source: 'none', invoiceNote: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.' };
  }
  if (category === 'exempt') return { rate: 0, treatment: 'exempt', source: 'table', taxCountry: origin };

  if (dest === origin) {
    const r = lookupRate(origin, category, settings);
    return { ...r, treatment: 'domestic', taxCountry: origin };
  }

  const originEU = isEU(origin);
  const destEU = isEU(dest);

  if (originEU && destEU) {
    if (ctx.customerType === 'b2b' && ctx.vatIdValid) {
      return {
        rate: 0,
        treatment: 'reverse_charge',
        source: 'none',
        invoiceNote: 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, Art. 196 MwStSystRL).',
      };
    }
    // Locally supplied services (consulting) stay at origin for B2C.
    if (category === 'services' || !settings.oss) {
      const r = lookupRate(origin, category, settings);
      return { ...r, treatment: 'origin_rate', taxCountry: origin };
    }
    const r = lookupRate(dest, category, settings);
    return { ...r, treatment: 'oss_destination', taxCountry: dest };
  }

  // Non-EU destination (or non-EU origin)
  if (settings.registrations.includes(dest)) {
    const r = lookupRate(dest, category, settings);
    return { ...r, treatment: 'registered_destination', taxCountry: dest };
  }
  if (category === 'services' && ctx.customerType === 'b2c') {
    const r = lookupRate(origin, category, settings);
    return { ...r, treatment: 'origin_rate', taxCountry: origin };
  }
  return { rate: 0, treatment: 'export', source: 'none', invoiceNote: 'Steuerfreie Ausfuhrlieferung / nicht steuerbare Leistung.' };
}

/** VAT contained in a gross amount: gross × r / (1 + r). */
export function taxFromGross(gross: number, rate: BasisPoints): number {
  if (rate === 0) return 0;
  return roundHalfUp((gross * rate) / (10_000 + rate));
}

/** Gross amount from a net amount. */
export function grossFromNet(net: number, rate: BasisPoints): number {
  return roundHalfUp((net * (10_000 + rate)) / 10_000);
}

/**
 * Convert a stored gross price (incl. origin-country VAT) to the gross price for
 * the resolved destination rate according to the store's price strategy.
 */
export function adjustGrossPrice(storedGross: number, originRate: BasisPoints, destRate: BasisPoints, strategy: TaxSettings['priceStrategy'], treatment: TaxTreatment): number {
  if (originRate === destRate) return storedGross;
  const net = storedGross - taxFromGross(storedGross, originRate);
  // Zero-rated (export / reverse charge): customer pays the net price under either strategy.
  if (destRate === 0 && (treatment === 'export' || treatment === 'reverse_charge')) return net;
  if (strategy === 'gross-constant') return storedGross;
  return grossFromNet(net, destRate);
}
