import { z } from 'zod';
import { roundHalfUp } from './money';

/**
 * Grundpreis (unit price) according to § 4 PAngV: goods sold by weight, volume,
 * length or area must show the price per 1 kg / 1 l / 1 m / 1 m².
 */
export const unitMeasureSchema = z.object({
  unit: z.enum(['g', 'kg', 'ml', 'l', 'cm', 'm', 'm2']),
  amount: z.number().positive(),
});
export type UnitMeasure = z.infer<typeof unitMeasureSchema>;

const BASE: Record<UnitMeasure['unit'], { base: 'kg' | 'l' | 'm' | 'm2'; factor: number }> = {
  g: { base: 'kg', factor: 1000 },
  kg: { base: 'kg', factor: 1 },
  ml: { base: 'l', factor: 1000 },
  l: { base: 'l', factor: 1 },
  cm: { base: 'm', factor: 100 },
  m: { base: 'm', factor: 1 },
  m2: { base: 'm2', factor: 1 },
};

export function unitPrice(priceMinor: number, measure: UnitMeasure): { amount: number; per: 'kg' | 'l' | 'm' | 'm2' } {
  const { base, factor } = BASE[measure.unit];
  const qtyInBase = measure.amount / factor;
  return { amount: roundHalfUp(priceMinor / qtyInBase), per: base };
}
