import type { PaymentOrder, PaymentProvider } from './registry.js';

/** Vorkasse / bank transfer — very popular in DACH. An admin marks the order paid on receipt. */
export class PrepaymentProvider implements PaymentProvider {
  id = 'prepayment';
  label = { de: 'Vorkasse (Überweisung)', en: 'Bank transfer (prepayment)' };
  methods = ['bank_transfer'];
  constructor(public bank: { accountHolder: string; iban: string; bic?: string; bankName?: string }) {}
  async createPayment(order: PaymentOrder) {
    return {
      action: { type: 'bank_transfer' as const, ...this.bank, reference: order.number, amount: order.total, currency: order.currency },
      providerRef: order.number,
    };
  }
}
