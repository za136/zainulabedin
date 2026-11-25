/**
 * @factory/sdk — the public contract of the store factory API.
 *
 * Any frontend (the bundled Next.js storefront, a mobile app, a Shopify-Hydrogen-
 * style custom storefront, an AI agent) can use this client. Types here are the
 * stable API shapes; the OpenAPI spec lives in apps/api/openapi.json.
 */
import type { Billing, ConsentRequirement, DiagramScene, Locale, LocalizedText, PricingResult, ProductKind, ProductKindDefinition } from '@factory/core';

export type Currency = 'EUR' | 'CHF' | 'USD' | 'GBP';
export interface Market {
  locale: Locale;
  country: string;
  currency: Currency;
}

export interface PriceView {
  amount: number;
  currency: Currency;
  compareAt: number | null;
  unitPrice?: { amount: number; per: string };
}
export type StockState = 'in_stock' | 'low_stock' | 'out_of_stock' | 'unlimited';

export interface ProductCard {
  id: string;
  slug: string;
  kind: ProductKind;
  title: string;
  subtitle: string | null;
  brand: string | null;
  image: { src: string; alt?: LocalizedText } | null;
  featured: boolean;
  priceBound: boolean;
  price: PriceView | null;
  priceVaries: boolean;
  inStock: boolean;
  rating: { avg: number; count: number } | null;
  authors: string[];
  tags: string[];
  previewDiagram: string | null;
}

export interface VariantView {
  id: string;
  sku: string;
  title: LocalizedText | null;
  options: Record<string, string>;
  price: PriceView | null;
  stock: StockState;
  available: number | null;
  billing: Billing | null;
}

export interface ProductDetail extends ProductCard {
  description: string;
  images: { src: string; alt?: LocalizedText }[];
  attributes: Record<string, any>;
  variants: VariantView[];
  categories: { slug: string; name: string }[];
  tax: { rate: number; treatment: string; category: string };
  withdrawal: 'standard_14d' | 'digital_content' | 'service';
  requiresShipping: boolean;
  editions: ProductCard[];
  seller: { slug: string; name: string } | null;
}

export interface ProductList {
  items: ProductCard[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  facets: { kinds: Partial<Record<ProductKind, number>> };
}

export interface Category {
  slug: string;
  name: string;
  description: string | null;
  image: string | null;
  productCount: number;
  children: Category[];
}

export interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
  remaining: number;
}

export interface CartItem {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  kind: ProductKind;
  title: string;
  variantTitle: string | null;
  sku: string;
  image: { src: string } | null;
  quantity: number;
  maxQuantity: number | null;
  slot: { id: string; startsAt: string; endsAt: string } | null;
  priceBound: boolean;
  available: boolean;
  pricing: PricingResult['lines'][number] | null;
}

export interface Cart {
  id: string;
  status: 'open' | 'converted' | 'abandoned';
  currency: Currency;
  country: string;
  locale: Locale;
  couponCode: string | null;
  items: CartItem[];
  itemCount: number;
  pricing: PricingResult;
  consents: ConsentRequirement[];
  requiresShipping: boolean;
  checkoutReady: boolean;
  problems: string[];
}

export interface Address {
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

export interface CheckoutInput {
  cartId: string;
  email: string;
  billingAddress: Address;
  shippingAddress?: Address;
  customerType?: 'b2c' | 'b2b';
  vatId?: string;
  consents: { terms: boolean; digital_waiver?: boolean; service_early_start?: boolean };
  paymentProvider: string;
  createAccountPassword?: string;
}

export type PaymentAction =
  | { type: 'redirect'; url: string }
  | { type: 'bank_transfer'; accountHolder: string; iban: string; bic?: string; bankName?: string; reference: string; amount: number; currency: string }
  | { type: 'none' };

export interface CheckoutResult {
  orderId: string;
  number: string;
  accessToken: string;
  total: number;
  currency: Currency;
  payment: PaymentAction;
  session?: { token: string; expiresAt: string };
}

export interface OrderItem {
  id: string;
  kind: ProductKind;
  sku: string;
  title: string;
  variantTitle: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  taxRate: number;
  taxAmount: number;
  fulfillmentStatus: 'unfulfilled' | 'scheduled' | 'fulfilled' | 'cancelled' | 'returned';
  trackingNumber: string | null;
  meta: Record<string, any>;
}

export interface Order {
  id: string;
  number: string;
  email: string;
  status: 'pending_payment' | 'paid' | 'processing' | 'partially_fulfilled' | 'fulfilled' | 'completed' | 'cancelled' | 'refunded';
  paymentStatus: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
  currency: Currency;
  locale: Locale;
  country: string;
  billingAddress: Address;
  shippingAddress: Address | null;
  totals: { subtotal: number; discountTotal: number; shipping: number; taxTotal: number; total: number; taxLines: PricingResult['taxLines']; invoiceNotes: string[]; shippingRate?: { id: string; name: LocalizedText; minDays: number; maxDays: number } };
  paymentProvider: string;
  placedAt: string;
  paidAt: string | null;
  items?: OrderItem[];
}

export interface Customer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'customer' | 'admin' | 'seller';
  locale: string;
}

export interface LibraryItem {
  id: string;
  type: 'download' | 'ebook' | 'interactive_book' | 'course' | 'license' | 'subscription';
  status: string;
  available: boolean;
  startsAt: string;
  expiresAt: string | null;
  product: ProductCard | null;
  files: { key: string; name: string; format?: string; url: string | null }[];
  licenseKeys: string[];
  diagrams: string[];
  watermark: string | null;
  course: { modules: { id: string; title: LocalizedText; lessons: { id: string; title: LocalizedText; durationMinutes?: number; preview: boolean }[] }[]; completed: string[]; progress: number } | null;
  grantsAccessTo: ProductCard[];
}

export interface Subscription {
  id: string;
  productId: string;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  amount: number;
  currency: Currency;
  billing: Billing;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string | null;
  verifiedPurchase: boolean;
  createdAt: string;
}

export type HomeSection =
  | { type: 'hero'; title: LocalizedText; subtitle?: LocalizedText; cta?: { label: LocalizedText; href: string }; secondaryCta?: { label: LocalizedText; href: string }; image?: string; diagram?: string }
  | { type: 'kinds'; title: LocalizedText; kinds?: ProductKind[] }
  | { type: 'categories'; title: LocalizedText }
  | { type: 'products'; title: LocalizedText; query: { kind?: ProductKind; category?: string; featured?: boolean; sort?: string; limit: number } }
  | { type: 'usp'; items: { icon: string; title: LocalizedText; text: LocalizedText }[] }
  | { type: 'banner'; title: LocalizedText; text?: LocalizedText; cta?: { label: LocalizedText; href: string }; image?: string; tone: 'primary' | 'accent' | 'muted' }
  | { type: 'diagram'; title: LocalizedText; text?: LocalizedText; diagram: string };

export interface StorePublic {
  id: string;
  name: string;
  tagline: LocalizedText;
  url: string;
  locales: { default: Locale; supported: Locale[] };
  markets: { country: string; currency: Currency; default?: boolean }[];
  market: Market;
  legal: Record<string, any> & { company: string; street: string; zip: string; city: string; email: string };
  theme: {
    preset: string;
    colors: Record<'background' | 'foreground' | 'muted' | 'mutedForeground' | 'border' | 'primary' | 'primaryForeground' | 'accent' | 'accentForeground' | 'success' | 'danger', string>;
    radius: string;
    fonts: { heading: string; body: string };
    logo: { text: string; src?: string; mark?: string };
  };
  home: { sections: HomeSection[] };
  seo: { titleTemplate: string; description: LocalizedText };
  features: { guestCheckout: boolean; reviews: boolean; wishlist: boolean; b2b: boolean; marketplace: boolean };
  catalog: { enabledKinds: ProductKind[] };
  kinds: Partial<Record<ProductKind, ProductKindDefinition>>;
  shipping: { zones: { id: string; name: LocalizedText; countries: string[]; rates: { id: string; name: LocalizedText; price: Partial<Record<Currency, number>>; freeAbove?: Partial<Record<Currency, number>>; minDays: number; maxDays: number }[] }[] };
  tax: { originCountry: string; smallBusiness: boolean };
  payments: { id: string; label: { de: string; en: string }; methods: string[]; bank?: { accountHolder: string; iban: string; bic?: string; bankName?: string } }[];
  orderButtonLabel: { de: string; en: string };
  diagrams: { id: string; title: LocalizedText }[];
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export interface ClientOptions {
  baseUrl: string;
  /** Bearer session token (from login/register) */
  token?: string;
  market?: Partial<Market>;
  fetch?: typeof fetch;
  /** Extra fetch init (e.g. Next.js `{ next: { revalidate: 60 } }`) */
  init?: RequestInit & Record<string, unknown>;
}

type Query = Record<string, string | number | boolean | undefined | null>;

export function createClient(opts: ClientOptions) {
  const f = opts.fetch ?? fetch;
  const base = opts.baseUrl.replace(/\/$/, '');

  async function req<T>(method: string, path: string, body?: unknown, query: Query = {}, init: RequestInit & Record<string, unknown> = {}): Promise<T> {
    const url = new URL(base + path);
    const q: Query = { locale: opts.market?.locale, country: opts.market?.country, currency: opts.market?.currency, ...query };
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    const headers: Record<string, string> = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    const res = await f(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), ...opts.init, ...init });
    const text = await res.text();
    const data = text ? (res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text) : undefined;
    if (!res.ok) {
      const e = (data as { error?: { code: string; message: string; details?: unknown } })?.error;
      throw new ApiError(res.status, e?.code ?? 'http_error', e?.message ?? res.statusText, e?.details);
    }
    return data as T;
  }

  return {
    store: () => req<StorePublic>('GET', '/v1/store'),
    content: (key: string) => req<{ key: string; locale: Locale; markdown: string }>('GET', `/v1/content/${key}`),
    catalog: {
      list: (q: { q?: string; kind?: ProductKind; category?: string; featured?: boolean; inStock?: boolean; sort?: string; page?: number; pageSize?: number; slugs?: string[] } = {}) =>
        req<ProductList>('GET', '/v1/catalog/products', undefined, { ...q, slugs: q.slugs?.join(',') }),
      get: (slug: string) => req<ProductDetail>('GET', `/v1/catalog/products/${encodeURIComponent(slug)}`),
      slots: (slug: string) => req<{ slots: Slot[] }>('GET', `/v1/catalog/products/${encodeURIComponent(slug)}/slots`, undefined, {}, { cache: 'no-store' }),
      categories: () => req<{ categories: Category[] }>('GET', '/v1/catalog/categories'),
      reviews: (slug: string) => req<{ reviews: Review[]; summary: { avg: number; count: number } | null }>('GET', `/v1/catalog/products/${encodeURIComponent(slug)}/reviews`),
      review: (slug: string, body: { rating: number; title?: string; body?: string }) => req<{ status: string; verifiedPurchase: boolean }>('POST', `/v1/catalog/products/${encodeURIComponent(slug)}/reviews`, body),
    },
    diagram: (id: string) => req<DiagramScene>('GET', `/v1/diagrams/${encodeURIComponent(id)}`, undefined, {}, { cache: 'no-store' }),
    cart: {
      create: (market?: Partial<Market>) => req<Cart>('POST', '/v1/carts', market ?? {}),
      get: (id: string) => req<Cart>('GET', `/v1/carts/${id}`, undefined, {}, { cache: 'no-store' }),
      update: (id: string, patch: { country?: string; currency?: string; locale?: string; couponCode?: string | null; shippingRateId?: string | null }) => req<Cart>('PATCH', `/v1/carts/${id}`, patch),
      addItem: (id: string, item: { variantId: string; quantity?: number; slotId?: string }) => req<Cart>('POST', `/v1/carts/${id}/items`, item),
      setQuantity: (id: string, itemId: string, quantity: number) => req<Cart>('PATCH', `/v1/carts/${id}/items/${itemId}`, { quantity }),
      removeItem: (id: string, itemId: string) => req<Cart>('DELETE', `/v1/carts/${id}/items/${itemId}`),
    },
    checkout: (input: CheckoutInput) => req<CheckoutResult>('POST', '/v1/checkout', input),
    orders: {
      get: (id: string, token?: string) => req<Order>('GET', `/v1/orders/${id}`, undefined, { token }, { cache: 'no-store' }),
      invoiceUrl: (id: string, token?: string) => `${base}/v1/orders/${id}/invoice${token ? `?token=${encodeURIComponent(token)}` : ''}`,
    },
    payments: {
      mockConfirm: (orderId: string, token: string, outcome: 'success' | 'failure' = 'success') => req<Order>('POST', '/v1/payments/mock/confirm', { orderId, token, outcome }),
    },
    auth: {
      register: (b: { email: string; password: string; firstName?: string; lastName?: string; locale?: string; marketingConsent?: boolean; claim?: { orderId: string; token: string } }) =>
        req<{ token: string; expiresAt: string; customer: Customer }>('POST', '/v1/auth/register', b),
      login: (b: { email: string; password: string; claim?: { orderId: string; token: string } }) => req<{ token: string; expiresAt: string; customer: Customer }>('POST', '/v1/auth/login', b),
      logout: () => req<{ ok: true }>('POST', '/v1/auth/logout'),
    },
    me: {
      get: () => req<{ customer: Customer }>('GET', '/v1/me', undefined, {}, { cache: 'no-store' }),
      orders: () => req<{ orders: Order[] }>('GET', '/v1/me/orders', undefined, {}, { cache: 'no-store' }),
      library: () => req<{ items: LibraryItem[] }>('GET', '/v1/me/library', undefined, {}, { cache: 'no-store' }),
      completeLesson: (entitlementId: string, lessonId: string) => req<{ ok: true }>('POST', `/v1/me/library/${entitlementId}/lessons/${lessonId}/complete`),
      subscriptions: () => req<{ subscriptions: Subscription[] }>('GET', '/v1/me/subscriptions', undefined, {}, { cache: 'no-store' }),
      cancelSubscription: (id: string) => req<Subscription>('POST', `/v1/me/subscriptions/${id}/cancel`),
      delete: () => req<{ ok: true }>('DELETE', '/v1/me'),
    },
    admin: {
      stats: () => req<Record<string, any>>('GET', '/v1/admin/stats', undefined, {}, { cache: 'no-store' }),
      orders: (status?: string) => req<{ orders: Order[] }>('GET', '/v1/admin/orders', undefined, { status }, { cache: 'no-store' }),
      markPaid: (id: string) => req<Order>('POST', `/v1/admin/orders/${id}/mark-paid`),
      ship: (id: string, itemId: string, trackingNumber?: string) => req<Order>('POST', `/v1/admin/orders/${id}/items/${itemId}/ship`, { trackingNumber }),
      cancel: (id: string) => req<Order>('POST', `/v1/admin/orders/${id}/cancel`, {}),
      reseed: () => req<{ products: number; categories: number }>('POST', '/v1/admin/reseed'),
    },
  };
}
export type StoreClient = ReturnType<typeof createClient>;
