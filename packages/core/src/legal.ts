import { kindDef, type ProductKind } from './product-kinds.js';

/**
 * German/EU consumer-law rules that shape the checkout.
 * (Not legal advice — the factory encodes common practice; have texts reviewed.)
 */

export const WITHDRAWAL_PERIOD_DAYS = 14;

export type ConsentKey =
  /** AGB + Widerrufsbelehrung acknowledged */
  | 'terms'
  /** § 356 Abs. 5 BGB: consent to immediate delivery of digital content + acknowledgement of losing the withdrawal right */
  | 'digital_waiver'
  /** § 356 Abs. 4 BGB: request to start a service before the withdrawal period ends */
  | 'service_early_start';

export interface ConsentRequirement {
  key: ConsentKey;
  /** If not required, the order can still be placed but changes fulfillment timing */
  required: boolean;
  label: { de: string; en: string };
}

export function consentRequirements(kinds: ProductKind[]): ConsentRequirement[] {
  const rules = new Set(kinds.map((k) => kindDef(k).withdrawal));
  const reqs: ConsentRequirement[] = [
    {
      key: 'terms',
      required: true,
      label: {
        de: 'Ich habe die AGB gelesen und akzeptiere sie. Die Widerrufsbelehrung und die Datenschutzerklärung habe ich zur Kenntnis genommen.',
        en: 'I have read and accept the terms and conditions. I have taken note of the cancellation policy and privacy policy.',
      },
    },
  ];
  if (rules.has('digital_content')) {
    reqs.push({
      key: 'digital_waiver',
      required: false,
      label: {
        de: 'Ich stimme ausdrücklich zu, dass mit der Bereitstellung der digitalen Inhalte vor Ablauf der Widerrufsfrist begonnen wird. Mir ist bekannt, dass ich dadurch mein Widerrufsrecht verliere.',
        en: 'I expressly agree that provision of the digital content begins before the end of the withdrawal period. I acknowledge that I thereby lose my right of withdrawal.',
      },
    });
  }
  if (rules.has('service')) {
    reqs.push({
      key: 'service_early_start',
      required: false,
      label: {
        de: 'Ich verlange ausdrücklich, dass mit der Dienstleistung vor Ablauf der Widerrufsfrist begonnen wird. Mir ist bekannt, dass mein Widerrufsrecht bei vollständiger Vertragserfüllung erlischt.',
        en: 'I expressly request that the service begins before the end of the withdrawal period. I acknowledge that my right of withdrawal expires once the contract has been fully performed.',
      },
    });
  }
  return reqs;
}

export function validateConsents(kinds: ProductKind[], given: Partial<Record<ConsentKey, boolean>>): { ok: true } | { ok: false; missing: ConsentKey[] } {
  const missing = consentRequirements(kinds)
    .filter((r) => r.required && !given[r.key])
    .map((r) => r.key);
  return missing.length ? { ok: false, missing } : { ok: true };
}

/**
 * When digital content may be made available. Without the § 356(5) waiver the seller
 * must wait for the withdrawal period to end before delivering.
 */
export function digitalAccessStartsAt(paidAt: Date, waiverGiven: boolean): Date {
  if (waiverGiven) return paidAt;
  const d = new Date(paidAt);
  d.setUTCDate(d.getUTCDate() + WITHDRAWAL_PERIOD_DAYS);
  return d;
}

/** § 312j Abs. 3 BGB — the final checkout button must state the payment obligation unambiguously. */
export const ORDER_BUTTON_LABEL = { de: 'Zahlungspflichtig bestellen', en: 'Place order and pay' } as const;
