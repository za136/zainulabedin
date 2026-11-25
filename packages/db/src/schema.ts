import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import type { Billing, ConsentKey, FulfillmentStatus, LocalizedText, OrderStatus, PaymentStatus, PricingResult, ProductKind, TaxCategory, UnitMeasure } from '@factory/core';

/**
 * DATABASE SCHEMA
 * ===============
 * One database = one store (single-tenant per deployment keeps data isolation,
 * GDPR deletion and scaling simple). Marketplace sellers live *inside* a store.
 *
 * Conventions
 *  - ids are prefixed text ids (`prd_…`, `ord_…`) created by `@factory/core#id`
 *  - money columns are integer minor units, `currency` beside them
 *  - localized texts live in *_translations tables (one row per locale)
 *  - kind-specific product data lives in `products.attributes` (validated by the kind registry)
 *
 * After changing this file run `pnpm db:generate` to create a SQL migration.
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => ts('created_at').notNull().defaultNow();
const updatedAt = () => ts('updated_at').notNull().defaultNow();

/* ---------------------------------- people --------------------------------- */

export const customers = pgTable(
  'customers',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    company: text('company'),
    vatId: text('vat_id'),
    locale: text('locale').notNull().default('de'),
    role: text('role').$type<'customer' | 'admin' | 'seller'>().notNull().default('customer'),
    sellerId: text('seller_id'),
    marketingConsent: boolean('marketing_consent').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('customers_email_uq').on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    tokenHash: text('token_hash').notNull(),
    customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
    expiresAt: ts('expires_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('sessions_token_uq').on(t.tokenHash)],
);

export interface AddressData {
  firstName: string;
  lastName: string;
  company?: string;
  street: string;
  addressLine2?: string;
  zip: string;
  city: string;
  country: string;
  phone?: string;
}

export const addresses = pgTable('addresses', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<AddressData>().notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: createdAt(),
});

export const sellers = pgTable('sellers', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  commissionBps: integer('commission_bps').notNull().default(1500),
  status: text('status').$type<'active' | 'suspended'>().notNull().default('active'),
  createdAt: createdAt(),
});

/* ---------------------------------- catalog -------------------------------- */

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  parentId: text('parent_id'),
  position: integer('position').notNull().default(0),
  image: text('image'),
  createdAt: createdAt(),
});

export const categoryTranslations = pgTable(
  'category_translations',
  {
    categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    name: text('name').notNull(),
    description: text('description'),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.locale] })],
);

export interface ProductImage {
  src: string;
  alt?: LocalizedText;
}

export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    kind: text('kind').$type<ProductKind>().notNull(),
    status: text('status').$type<'draft' | 'active' | 'archived'>().notNull().default('draft'),
    featured: boolean('featured').notNull().default(false),
    taxCategory: text('tax_category').$type<TaxCategory>().notNull(),
    priceBound: boolean('price_bound').notNull().default(false),
    brand: text('brand'),
    sellerId: text('seller_id').references(() => sellers.id),
    images: jsonb('images').$type<ProductImage[]>().notNull().default([]),
    attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull().default({}),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    ratingAvg: integer('rating_avg_x100'),
    ratingCount: integer('rating_count').notNull().default(0),
    publishedAt: ts('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('products_kind_idx').on(t.kind), index('products_status_idx').on(t.status)],
);

export const productTranslations = pgTable(
  'product_translations',
  {
    productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    description: text('description').notNull().default(''),
  },
  (t) => [primaryKey({ columns: [t.productId, t.locale] })],
);

export const productCategories = pgTable(
  'product_categories',
  {
    productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.categoryId] })],
);

export const variants = pgTable(
  'variants',
  {
    id: text('id').primaryKey(),
    productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull().unique(),
    title: jsonb('title').$type<LocalizedText>(),
    options: jsonb('options').$type<Record<string, string>>().notNull().default({}),
    position: integer('position').notNull().default(0),
    /** null = stock not tracked (digital goods, services) */
    stockOnHand: integer('stock_on_hand'),
    stockReserved: integer('stock_reserved').notNull().default(0),
    weightGrams: integer('weight_grams').notNull().default(0),
    unitMeasure: jsonb('unit_measure').$type<UnitMeasure>(),
    billing: jsonb('billing').$type<Billing>(),
  },
  (t) => [index('variants_product_idx').on(t.productId)],
);

export const prices = pgTable(
  'prices',
  {
    variantId: text('variant_id').notNull().references(() => variants.id, { onDelete: 'cascade' }),
    currency: text('currency').notNull(),
    amount: integer('amount').notNull(),
    compareAt: integer('compare_at'),
  },
  (t) => [primaryKey({ columns: [t.variantId, t.currency] })],
);

export const serviceSlots = pgTable(
  'service_slots',
  {
    id: text('id').primaryKey(),
    productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    startsAt: ts('starts_at').notNull(),
    endsAt: ts('ends_at').notNull(),
    capacity: integer('capacity').notNull().default(1),
    booked: integer('booked').notNull().default(0),
  },
  (t) => [index('slots_product_idx').on(t.productId, t.startsAt)],
);

export const reviews = pgTable('reviews', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  authorName: text('author_name').notNull(),
  rating: integer('rating').notNull(),
  title: text('title'),
  body: text('body'),
  locale: text('locale').notNull().default('de'),
  verifiedPurchase: boolean('verified_purchase').notNull().default(false),
  status: text('status').$type<'pending' | 'published' | 'rejected'>().notNull().default('pending'),
  createdAt: createdAt(),
});

export const coupons = pgTable('coupons', {
  code: text('code').primaryKey(),
  type: text('type').$type<'percent' | 'fixed' | 'free_shipping'>().notNull(),
  value: integer('value').notNull(),
  currency: text('currency'),
  minSubtotal: integer('min_subtotal'),
  appliesToKinds: jsonb('applies_to_kinds').$type<ProductKind[]>(),
  appliesToCategories: jsonb('applies_to_categories').$type<string[]>(),
  startsAt: ts('starts_at'),
  endsAt: ts('ends_at'),
  usageLimit: integer('usage_limit'),
  usedCount: integer('used_count').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

/* ----------------------------------- carts --------------------------------- */

export const carts = pgTable('carts', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  currency: text('currency').notNull(),
  locale: text('locale').notNull(),
  country: text('country').notNull(),
  couponCode: text('coupon_code'),
  shippingRateId: text('shipping_rate_id'),
  status: text('status').$type<'open' | 'converted' | 'abandoned'>().notNull().default('open'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const cartItems = pgTable(
  'cart_items',
  {
    id: text('id').primaryKey(),
    cartId: text('cart_id').notNull().references(() => carts.id, { onDelete: 'cascade' }),
    variantId: text('variant_id').notNull().references(() => variants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    slotId: text('slot_id').references(() => serviceSlots.id),
    createdAt: createdAt(),
  },
  (t) => [index('cart_items_cart_idx').on(t.cartId)],
);

/* ----------------------------------- orders -------------------------------- */

export interface OrderTotals {
  subtotal: number;
  discountTotal: number;
  shipping: number;
  taxTotal: number;
  total: number;
  taxLines: PricingResult['taxLines'];
  invoiceNotes: string[];
  shippingRate?: { id: string; name: LocalizedText; minDays: number; maxDays: number };
}

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    number: text('number').notNull().unique(),
    customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    email: text('email').notNull(),
    status: text('status').$type<OrderStatus>().notNull(),
    paymentStatus: text('payment_status').$type<PaymentStatus>().notNull(),
    currency: text('currency').notNull(),
    locale: text('locale').notNull(),
    country: text('country').notNull(),
    customerType: text('customer_type').$type<'b2c' | 'b2b'>().notNull().default('b2c'),
    vatId: text('vat_id'),
    billingAddress: jsonb('billing_address').$type<AddressData>().notNull(),
    shippingAddress: jsonb('shipping_address').$type<AddressData>(),
    totals: jsonb('totals').$type<OrderTotals>().notNull(),
    couponCode: text('coupon_code'),
    consents: jsonb('consents').$type<Partial<Record<ConsentKey, boolean>> & { at: string; ip?: string }>().notNull(),
    paymentProvider: text('payment_provider').notNull(),
    paymentRef: text('payment_ref'),
    /** guest access token hash (order status page without account) */
    accessTokenHash: text('access_token_hash'),
    placedAt: ts('placed_at').notNull().defaultNow(),
    paidAt: ts('paid_at'),
    cancelledAt: ts('cancelled_at'),
    updatedAt: updatedAt(),
  },
  (t) => [index('orders_customer_idx').on(t.customerId), index('orders_status_idx').on(t.status)],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    productId: text('product_id').notNull(),
    variantId: text('variant_id').notNull(),
    kind: text('kind').$type<ProductKind>().notNull(),
    sku: text('sku').notNull(),
    title: text('title').notNull(),
    variantTitle: text('variant_title'),
    quantity: integer('quantity').notNull(),
    unitPrice: integer('unit_price').notNull(),
    discount: integer('discount').notNull().default(0),
    total: integer('total').notNull(),
    taxRate: integer('tax_rate').notNull(),
    taxAmount: integer('tax_amount').notNull(),
    sellerId: text('seller_id'),
    slotId: text('slot_id'),
    fulfillmentStatus: text('fulfillment_status').$type<FulfillmentStatus>().notNull().default('unfulfilled'),
    trackingNumber: text('tracking_number'),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerRef: text('provider_ref'),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  status: text('status').$type<'pending' | 'succeeded' | 'failed' | 'refunded'>().notNull(),
  raw: jsonb('raw').$type<unknown>(),
  createdAt: createdAt(),
});

/* -------------------------- entitlements & fulfillment --------------------- */

export type EntitlementType = 'download' | 'ebook' | 'interactive_book' | 'course' | 'license' | 'subscription';

export const entitlements = pgTable(
  'entitlements',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
    /** guest purchases are linked by email and claimed on registration */
    email: text('email').notNull(),
    productId: text('product_id').notNull().references(() => products.id),
    orderItemId: text('order_item_id').references(() => orderItems.id, { onDelete: 'set null' }),
    subscriptionId: text('subscription_id'),
    type: text('type').$type<EntitlementType>().notNull(),
    status: text('status').$type<'active' | 'revoked' | 'expired'>().notNull().default('active'),
    startsAt: ts('starts_at').notNull(),
    expiresAt: ts('expires_at'),
    downloadsUsed: integer('downloads_used').notNull().default(0),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('entitlements_customer_idx').on(t.customerId), index('entitlements_email_idx').on(t.email)],
);

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  productId: text('product_id').notNull(),
  variantId: text('variant_id').notNull(),
  orderId: text('order_id').notNull(),
  status: text('status').$type<'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired'>().notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  billing: jsonb('billing').$type<Billing>().notNull(),
  currentPeriodStart: ts('current_period_start').notNull(),
  currentPeriodEnd: ts('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  providerRef: text('provider_ref'),
  createdAt: createdAt(),
});

export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  orderItemId: text('order_item_id').notNull().references(() => orderItems.id, { onDelete: 'cascade' }),
  slotId: text('slot_id').notNull().references(() => serviceSlots.id),
  customerId: text('customer_id'),
  email: text('email').notNull(),
  status: text('status').$type<'confirmed' | 'cancelled' | 'completed'>().notNull().default('confirmed'),
  createdAt: createdAt(),
});

export const courseProgress = pgTable(
  'course_progress',
  {
    entitlementId: text('entitlement_id').notNull().references(() => entitlements.id, { onDelete: 'cascade' }),
    lessonId: text('lesson_id').notNull(),
    completedAt: ts('completed_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.entitlementId, t.lessonId] })],
);

/* --------------------------------- plumbing -------------------------------- */

/** Gap-free counters (order numbers per year). Updated with row locks. */
export const counters = pgTable('counters', {
  name: text('name').primaryKey(),
  value: integer('value').notNull().default(0),
});

/**
 * Transactional outbox: domain events are written in the same transaction as the
 * state change, then dispatched (emails, webhooks, search indexing, analytics).
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
    processedAt: ts('processed_at'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [index('outbox_unprocessed_idx').on(t.processedAt, t.createdAt)],
);
