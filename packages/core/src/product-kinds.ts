import { z } from 'zod';
import { localizedTextSchema } from './i18n';
import type { TaxCategory } from './tax';

/**
 * PRODUCT KIND REGISTRY
 * =====================
 * The factory sells anything by describing each *kind* of product once:
 * how it is shipped/fulfilled, which tax category it defaults to, which
 * withdrawal (Widerruf) rule applies and which attributes it carries.
 *
 * To add a new kind: add an entry below, add a fulfillment handler in
 * `apps/api/src/modules/fulfillment/handlers.ts`, and (optionally) a
 * product-detail block in `apps/web/src/components/product/kind-blocks.tsx`.
 */

export type FulfillmentStrategy =
  | 'shipment' // physical parcel
  | 'download' // file download links
  | 'entitlement' // access in the customer library (ebook reader, 3D viewer, course player)
  | 'license_key' // generated licence key
  | 'subscription' // recurring billing + time-boxed entitlement
  | 'booking'; // scheduled service / consulting slot

/**
 * - standard_14d: 14-day right of withdrawal (§ 355 BGB)
 * - digital_content: digital content — withdrawal right expires on delivery when the
 *   customer expressly consents & acknowledges (§ 356 Abs. 5 BGB)
 * - service: service — expires after full performance if the customer requested early
 *   start (§ 356 Abs. 4 BGB)
 */
export type WithdrawalRule = 'standard_14d' | 'digital_content' | 'service';

const gpsrSchema = z
  .object({
    manufacturer: z.string(),
    address: z.string(),
    contact: z.string().optional(),
    responsiblePersonEU: z.string().optional(),
    safetyInformation: localizedTextSchema.optional(),
  })
  .describe('EU General Product Safety Regulation (GPSR, VO (EU) 2023/988) information');

const fileSchema = z.object({ key: z.string(), name: z.string(), format: z.string().optional(), sizeBytes: z.number().int().optional() });

export const attributeSchemas = {
  physical: z.object({
    brand: z.string().optional(),
    specs: z.record(z.string(), localizedTextSchema.or(z.string())).optional(),
    gpsr: gpsrSchema.optional(),
    /** ElektroG / WEEE registration — electronics */
    weeeRegNo: z.string().optional(),
    energyLabel: z.object({ class: z.string(), sheetUrl: z.string().optional() }).optional(),
    warrantyMonths: z.number().int().optional(),
  }),
  book: z.object({
    isbn: z.string().optional(),
    authors: z.array(z.string()).default([]),
    publisher: z.string().optional(),
    language: z.string().optional(),
    pages: z.number().int().optional(),
    binding: z.enum(['hardcover', 'paperback', 'spiral', 'other']).optional(),
    edition: z.string().optional(),
    publishedAt: z.string().optional(),
    /** Companion interactive/3D edition product slug */
    interactiveEditionSlug: z.string().optional(),
  }),
  ebook: z.object({
    isbn: z.string().optional(),
    authors: z.array(z.string()).default([]),
    publisher: z.string().optional(),
    language: z.string().optional(),
    pages: z.number().int().optional(),
    files: z.array(fileSchema).default([]),
    /** Social DRM: personalised watermark with buyer name */
    watermark: z.boolean().default(true),
    interactiveEditionSlug: z.string().optional(),
  }),
  interactive_book: z.object({
    authors: z.array(z.string()).default([]),
    language: z.string().optional(),
    /** Diagram scene ids (see `packages/core/src/diagram.ts`) shipped with the book */
    diagrams: z.array(z.string()).default([]),
    /** One diagram that may be previewed without purchase */
    previewDiagram: z.string().optional(),
    chapters: z.array(z.object({ id: z.string(), title: localizedTextSchema, diagram: z.string().optional() })).default([]),
    files: z.array(fileSchema).default([]),
  }),
  digital_download: z.object({
    files: z.array(fileSchema).default([]),
    maxDownloads: z.number().int().positive().optional(),
  }),
  license: z.object({
    platforms: z.array(z.string()).default([]),
    seats: z.number().int().positive().default(1),
    /** undefined = perpetual licence */
    durationDays: z.number().int().positive().optional(),
    keyPrefix: z.string().default('SF'),
    files: z.array(fileSchema).default([]),
  }),
  subscription: z.object({
    benefits: z.array(localizedTextSchema).default([]),
    /** Product slugs the subscriber gets access to (e.g. a whole interactive-book library) */
    grantsAccessTo: z.array(z.string()).default([]),
  }),
  course: z.object({
    level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    language: z.string().optional(),
    certificate: z.boolean().default(false),
    instructors: z.array(z.string()).default([]),
    modules: z
      .array(
        z.object({
          id: z.string(),
          title: localizedTextSchema,
          lessons: z.array(z.object({ id: z.string(), title: localizedTextSchema, durationMinutes: z.number().int().optional(), preview: z.boolean().default(false) })),
        }),
      )
      .default([]),
  }),
  service: z.object({
    durationMinutes: z.number().int().positive().default(60),
    location: z.enum(['online', 'onsite', 'hybrid']).default('online'),
    bookingRequired: z.boolean().default(true),
    deliverables: z.array(localizedTextSchema).default([]),
  }),
} satisfies Record<string, z.ZodType>;

export type ProductKind = keyof typeof attributeSchemas;
export const PRODUCT_KINDS = Object.keys(attributeSchemas) as ProductKind[];
export const productKindSchema = z.enum(PRODUCT_KINDS as [ProductKind, ...ProductKind[]]);
export type ProductAttributes<K extends ProductKind> = z.infer<(typeof attributeSchemas)[K]>;

export interface ProductKindDefinition {
  kind: ProductKind;
  label: { de: string; en: string };
  fulfillment: FulfillmentStrategy;
  requiresShipping: boolean;
  defaultTaxCategory: TaxCategory;
  withdrawal: WithdrawalRule;
  /** Subject to fixed book prices (Buchpreisbindungsgesetz DE / BPrBG AT) when flagged on the product */
  priceBindingEligible: boolean;
  /** Can a customer buy more than one? */
  quantityAllowed: boolean;
}

export const PRODUCT_KIND_DEFINITIONS: Record<ProductKind, ProductKindDefinition> = {
  physical: { kind: 'physical', label: { de: 'Artikel', en: 'Product' }, fulfillment: 'shipment', requiresShipping: true, defaultTaxCategory: 'standard', withdrawal: 'standard_14d', priceBindingEligible: false, quantityAllowed: true },
  book: { kind: 'book', label: { de: 'Buch', en: 'Book' }, fulfillment: 'shipment', requiresShipping: true, defaultTaxCategory: 'books', withdrawal: 'standard_14d', priceBindingEligible: true, quantityAllowed: true },
  ebook: { kind: 'ebook', label: { de: 'E-Book', en: 'E-book' }, fulfillment: 'entitlement', requiresShipping: false, defaultTaxCategory: 'ebooks', withdrawal: 'digital_content', priceBindingEligible: true, quantityAllowed: false },
  // NOTE: whether an interactive 3D edition qualifies for the reduced e-book rate depends on
  // its character (predominantly text/diagrams → likely yes; app/game-like → standard). Override per product.
  interactive_book: { kind: 'interactive_book', label: { de: 'Interaktives 3D-Buch', en: 'Interactive 3D book' }, fulfillment: 'entitlement', requiresShipping: false, defaultTaxCategory: 'ebooks', withdrawal: 'digital_content', priceBindingEligible: true, quantityAllowed: false },
  digital_download: { kind: 'digital_download', label: { de: 'Download', en: 'Download' }, fulfillment: 'download', requiresShipping: false, defaultTaxCategory: 'digital_services', withdrawal: 'digital_content', priceBindingEligible: false, quantityAllowed: false },
  license: { kind: 'license', label: { de: 'Software-Lizenz', en: 'Software licence' }, fulfillment: 'license_key', requiresShipping: false, defaultTaxCategory: 'digital_services', withdrawal: 'digital_content', priceBindingEligible: false, quantityAllowed: true },
  subscription: { kind: 'subscription', label: { de: 'Abonnement', en: 'Subscription' }, fulfillment: 'subscription', requiresShipping: false, defaultTaxCategory: 'digital_services', withdrawal: 'digital_content', priceBindingEligible: false, quantityAllowed: false },
  course: { kind: 'course', label: { de: 'Online-Kurs', en: 'Online course' }, fulfillment: 'entitlement', requiresShipping: false, defaultTaxCategory: 'digital_services', withdrawal: 'digital_content', priceBindingEligible: false, quantityAllowed: false },
  service: { kind: 'service', label: { de: 'Dienstleistung / Beratung', en: 'Service / consulting' }, fulfillment: 'booking', requiresShipping: false, defaultTaxCategory: 'services', withdrawal: 'service', priceBindingEligible: false, quantityAllowed: true },
};

export function kindDef(kind: ProductKind): ProductKindDefinition {
  return PRODUCT_KIND_DEFINITIONS[kind];
}

export function parseAttributes<K extends ProductKind>(kind: K, raw: unknown): ProductAttributes<K> {
  return attributeSchemas[kind].parse(raw ?? {}) as ProductAttributes<K>;
}

/** Subscription billing definition stored on a variant. */
export const billingSchema = z.object({
  interval: z.enum(['week', 'month', 'year']),
  intervalCount: z.number().int().positive().default(1),
  trialDays: z.number().int().nonnegative().default(0),
});
export type Billing = z.infer<typeof billingSchema>;

export function addInterval(date: Date, billing: Pick<Billing, 'interval' | 'intervalCount'>): Date {
  const d = new Date(date);
  if (billing.interval === 'week') d.setUTCDate(d.getUTCDate() + 7 * billing.intervalCount);
  if (billing.interval === 'month') d.setUTCMonth(d.getUTCMonth() + billing.intervalCount);
  if (billing.interval === 'year') d.setUTCFullYear(d.getUTCFullYear() + billing.intervalCount);
  return d;
}
