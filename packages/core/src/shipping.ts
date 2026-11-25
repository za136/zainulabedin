import { z } from 'zod';
import { localizedTextSchema } from './i18n';
import type { Currency } from './money';

export const shippingRateSchema = z.object({
  id: z.string(),
  name: localizedTextSchema,
  carrier: z.string().optional(),
  /** price per currency in minor units (gross) */
  price: z.partialRecord(z.enum(['EUR', 'CHF', 'USD', 'GBP']), z.number().int().nonnegative()),
  /** free shipping when the shippable subtotal (after discounts) reaches this amount */
  freeAbove: z.partialRecord(z.enum(['EUR', 'CHF', 'USD', 'GBP']), z.number().int().nonnegative()).optional(),
  /** Only offered when total weight is at most this many grams */
  maxWeightGrams: z.number().int().positive().optional(),
  minDays: z.number().int().nonnegative(),
  maxDays: z.number().int().nonnegative(),
});
export type ShippingRate = z.infer<typeof shippingRateSchema>;

export const shippingZoneSchema = z.object({
  id: z.string(),
  name: localizedTextSchema,
  countries: z.array(z.string().length(2)),
  rates: z.array(shippingRateSchema).min(1),
});
export type ShippingZone = z.infer<typeof shippingZoneSchema>;

export interface ShippingQuote {
  rateId: string;
  name: ShippingRate['name'];
  carrier?: string;
  amount: number;
  free: boolean;
  minDays: number;
  maxDays: number;
}

export function zoneFor(zones: ShippingZone[], country: string): ShippingZone | undefined {
  return zones.find((z) => z.countries.includes(country)) ?? zones.find((z) => z.countries.includes('*'));
}

export function quoteShipping(zones: ShippingZone[], country: string, currency: Currency, shippableSubtotal: number, weightGrams: number): ShippingQuote[] {
  const zone = zoneFor(zones, country);
  if (!zone) return [];
  return zone.rates
    .filter((r) => r.price[currency] !== undefined)
    .filter((r) => r.maxWeightGrams === undefined || weightGrams <= r.maxWeightGrams)
    .map((r) => {
      const threshold = r.freeAbove?.[currency];
      const free = threshold !== undefined && shippableSubtotal >= threshold;
      return { rateId: r.id, name: r.name, carrier: r.carrier, amount: free ? 0 : r.price[currency]!, free, minDays: r.minDays, maxDays: r.maxDays };
    })
    .sort((a, b) => a.amount - b.amount);
}
