import type Stripe from 'stripe';
import type { PaymentOrder, PaymentProvider } from './registry.js';

/**
 * Stripe Checkout — covers the DACH favourites (PayPal, Klarna, SEPA Lastschrift,
 * cards, Apple/Google Pay, EPS, TWINT) through one integration.
 * Webhooks: POST /v1/payments/stripe/webhook (checkout.session.completed,
 * checkout.session.async_payment_succeeded for SEPA).
 */
export class StripeProvider implements PaymentProvider {
  id = 'stripe';
  label = { de: 'PayPal, Klarna, Karte, SEPA & mehr', en: 'PayPal, Klarna, card, SEPA & more' };
  private client?: Stripe;
  constructor(private secretKey: string, public methods: string[], private webUrl: string) {}

  async stripe(): Promise<Stripe> {
    if (!this.client) {
      const { default: StripeCtor } = await import('stripe');
      this.client = new StripeCtor(this.secretKey);
    }
    return this.client;
  }

  async createPayment(order: PaymentOrder) {
    const stripe = await this.stripe();
    const prefix = order.locale === 'de' ? '' : `/${order.locale}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: order.email,
      locale: order.locale === 'de' ? 'de' : 'en',
      payment_method_types: this.methods as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
      // One line with the final gross total: tax was already computed by the core engine.
      line_items: [{ quantity: 1, price_data: { currency: order.currency.toLowerCase(), unit_amount: order.total, product_data: { name: `Bestellung ${order.number}` } } }],
      metadata: { orderId: order.id, orderNumber: order.number },
      success_url: `${this.webUrl}${prefix}/checkout/success?order=${order.id}&token=${order.accessToken}`,
      cancel_url: `${this.webUrl}${prefix}/cart`,
    });
    return { action: { type: 'redirect' as const, url: session.url! }, providerRef: session.id };
  }
}
