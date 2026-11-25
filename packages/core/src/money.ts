/**
 * Money is always represented as an integer amount of minor units (cents / Rappen)
 * plus an ISO-4217 currency code. Never use floats for money.
 */
export const CURRENCIES = ['EUR', 'CHF', 'USD', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface Money {
  amount: number; // integer minor units
  currency: Currency;
}

export function money(amount: number, currency: Currency): Money {
  assertInteger(amount);
  return { amount, currency };
}

export function assertInteger(n: number): void {
  if (!Number.isSafeInteger(n)) throw new RangeError(`Money amount must be a safe integer (minor units), got ${n}`);
}

/** Round half away from zero — the commercial rounding used for German invoices. */
export function roundHalfUp(n: number): number {
  // Guard against binary float artifacts like 2.4999999999 for 2.5
  const r = Math.round(Math.abs(n) * 1e6) / 1e6;
  return Math.sign(n) * Math.floor(r + 0.5);
}

/** Basis points: 1900 = 19.00 % */
export type BasisPoints = number;

export function percentOf(amount: number, bps: BasisPoints): number {
  return roundHalfUp((amount * bps) / 10_000);
}

/**
 * Split `total` across `weights` proportionally using the largest remainder method,
 * so that the parts always sum up exactly to `total` (no lost cents).
 */
export function allocate(total: number, weights: number[]): number[] {
  assertInteger(total);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (sum === 0) return weights.map((_, i) => (i === 0 ? total : 0));
  const raw = weights.map((w) => (total * w) / sum);
  const floored = raw.map((r) => Math.floor(r));
  let remainder = total - floored.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floored[i]! += 1;
    remainder -= 1;
  }
  return floored;
}

const fmtCache = new Map<string, Intl.NumberFormat>();
export function formatMoney(m: Money, locale = 'de-DE'): string {
  const key = `${locale}|${m.currency}`;
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency });
    fmtCache.set(key, f);
  }
  return f.format(m.amount / 100);
}
