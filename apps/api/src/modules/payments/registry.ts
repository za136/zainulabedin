import type { StoreConfig } from '@factory/config';
import type { Env } from '../../env.js';
import { MockProvider } from './mock.js';
import { PrepaymentProvider } from './prepayment.js';
import { StripeProvider } from './stripe.js';

export interface PaymentOrder {
  id: string;
  number: string;
  total: number;
  currency: string;
  email: string;
  locale: string;
  accessToken: string;
}

export type PaymentAction =
  | { type: 'redirect'; url: string }
  | { type: 'bank_transfer'; accountHolder: string; iban: string; bic?: string; bankName?: string; reference: string; amount: number; currency: string }
  | { type: 'none' };

/**
 * PAYMENT PROVIDER CONTRACT
 * Add a provider by implementing this interface and registering it below.
 * Confirmation always flows through `markOrderPaid()` (orders.service) — from a
 * webhook, an admin action, or the dev mock — so fulfillment logic lives in one place.
 */
export interface PaymentProvider {
  id: string;
  label: { de: string; en: string };
  /** Payment methods shown in the checkout, e.g. ['paypal', 'klarna', 'card'] */
  methods: string[];
  createPayment(order: PaymentOrder): Promise<{ action: PaymentAction; providerRef?: string }>;
}

export class PaymentRegistry {
  private providers = new Map<string, PaymentProvider>();
  register(p: PaymentProvider) {
    this.providers.set(p.id, p);
  }
  get(id: string): PaymentProvider | undefined {
    return this.providers.get(id);
  }
  list(): PaymentProvider[] {
    return [...this.providers.values()];
  }
}

export function buildPaymentRegistry(config: StoreConfig, env: Env): PaymentRegistry {
  const reg = new PaymentRegistry();
  for (const p of config.payments.providers) {
    if (!p.enabled) continue;
    if (p.id === 'mock') {
      if (env.NODE_ENV === 'production') continue; // never offer fake payments in production
      reg.register(new MockProvider(env.WEB_URL));
    }
    if (p.id === 'prepayment') reg.register(new PrepaymentProvider(p.bank));
    if (p.id === 'stripe' && env.STRIPE_SECRET_KEY) reg.register(new StripeProvider(env.STRIPE_SECRET_KEY, p.methods, env.WEB_URL));
  }
  return reg;
}
