/**
 * EU VAT ID validation for B2B reverse charge.
 *   format: syntax check only — development/test
 *   vies:   EU Commission VIES REST API — production
 * Reverse charge is only applied when validation succeeds.
 */
export interface VatValidator {
  validate(vatId: string): Promise<{ valid: boolean; country?: string; name?: string }>;
}

const PATTERNS: Record<string, RegExp> = {
  AT: /^ATU\d{8}$/, BE: /^BE[01]\d{9}$/, BG: /^BG\d{9,10}$/, CY: /^CY\d{8}[A-Z]$/, CZ: /^CZ\d{8,10}$/, DE: /^DE\d{9}$/,
  DK: /^DK\d{8}$/, EE: /^EE\d{9}$/, EL: /^EL\d{9}$/, ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/, FI: /^FI\d{8}$/, FR: /^FR[A-HJ-NP-Z0-9]{2}\d{9}$/,
  HR: /^HR\d{11}$/, HU: /^HU\d{8}$/, IE: /^IE\d[A-Z0-9+*]\d{5}[A-Z]{1,2}$/, IT: /^IT\d{11}$/, LT: /^LT(\d{9}|\d{12})$/, LU: /^LU\d{8}$/,
  LV: /^LV\d{11}$/, MT: /^MT\d{8}$/, NL: /^NL\d{9}B\d{2}$/, PL: /^PL\d{10}$/, PT: /^PT\d{9}$/, RO: /^RO\d{2,10}$/, SE: /^SE\d{12}$/,
  SI: /^SI\d{8}$/, SK: /^SK\d{10}$/,
};

export function normalizeVatId(v: string): string {
  return v.replace(/[\s.-]/g, '').toUpperCase();
}

export function vatCountry(v: string): string {
  const c = v.slice(0, 2);
  return c === 'EL' ? 'GR' : c;
}

export class FormatVatValidator implements VatValidator {
  async validate(raw: string) {
    const v = normalizeVatId(raw);
    const re = PATTERNS[v.slice(0, 2)];
    return { valid: !!re && re.test(v), country: vatCountry(v) };
  }
}

export class ViesVatValidator implements VatValidator {
  async validate(raw: string) {
    const v = normalizeVatId(raw);
    if (!(await new FormatVatValidator().validate(v)).valid) return { valid: false };
    try {
      const res = await fetch('https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ countryCode: v.slice(0, 2), vatNumber: v.slice(2) }),
        signal: AbortSignal.timeout(8000),
      });
      const body = (await res.json()) as { valid?: boolean; name?: string };
      return { valid: !!body.valid, country: vatCountry(v), name: body.name };
    } catch {
      return { valid: false }; // VIES down → charge VAT (safe default)
    }
  }
}
