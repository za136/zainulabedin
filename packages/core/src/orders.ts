/**
 * Order state machine. Payment and fulfillment are tracked separately on the order
 * and each order item, the order `status` is the coarse lifecycle.
 */
export const ORDER_STATUSES = ['pending_payment', 'paid', 'processing', 'partially_fulfilled', 'fulfilled', 'completed', 'cancelled', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FULFILLMENT_STATUSES = ['unfulfilled', 'scheduled', 'fulfilled', 'cancelled', 'returned'] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['processing', 'partially_fulfilled', 'fulfilled', 'refunded', 'cancelled'],
  processing: ['partially_fulfilled', 'fulfilled', 'refunded', 'cancelled'],
  partially_fulfilled: ['fulfilled', 'refunded'],
  fulfilled: ['completed', 'refunded'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(public from: OrderStatus, public to: OrderStatus) {
    super(`Invalid order transition ${from} → ${to}`);
  }
}

export function transition(from: OrderStatus, to: OrderStatus): OrderStatus {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
  return to;
}

/** Derive the order status from item fulfillment states (after payment). */
export function deriveFulfillmentStatus(items: FulfillmentStatus[]): OrderStatus {
  const active = items.filter((s) => s !== 'cancelled');
  if (active.length === 0) return 'cancelled';
  if (active.every((s) => s === 'fulfilled')) return 'fulfilled';
  if (active.some((s) => s === 'fulfilled')) return 'partially_fulfilled';
  return 'processing';
}

/** Sequential, gap-free order/invoice numbers as required by § 14 UStG, e.g. `SF-2026-000042`. */
export function formatOrderNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}
