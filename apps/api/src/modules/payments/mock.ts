import type { PaymentOrder, PaymentProvider } from './registry.js';

/**
 * Development payment provider: redirects to the storefront's fake payment page,
 * which calls POST /v1/payments/mock/confirm. Disabled automatically in production.
 */
export class MockProvider implements PaymentProvider {
  id = 'mock';
  label = { de: 'Testzahlung (Entwicklung)', en: 'Test payment (development)' };
  methods = ['paypal', 'klarna', 'card', 'sepa_debit'];
  constructor(private webUrl: string) {}
  async createPayment(order: PaymentOrder) {
    const url = new URL(`${order.locale === 'de' ? '' : '/' + order.locale}/checkout/mock-pay`, this.webUrl);
    url.searchParams.set('order', order.id);
    url.searchParams.set('token', order.accessToken);
    return { action: { type: 'redirect' as const, url: url.toString() }, providerRef: `mock_${order.id}` };
  }
}
