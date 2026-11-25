import { z } from 'zod';
import { couponSchema, localeSchema, localizedTextSchema, productKindSchema, shippingZoneSchema, taxCategorySchema, unitMeasureSchema, billingSchema } from '@factory/core';

/**
 * STORE BLUEPRINT (store.json)
 * ============================
 * One JSON file fully describes a store: identity, legal entity, markets, tax,
 * enabled product kinds, shipping, payments, theme and home-page layout.
 * Everything else (API, storefront, seeds) is derived from it — point the
 * factory at another store folder and you get another shop.
 */

const currency = z.enum(['EUR', 'CHF', 'USD', 'GBP']);
const hex = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

export const legalEntitySchema = z
  .object({
    company: z.string().describe('Firmenname inkl. Rechtsform, e.g. "Wissenswerk GmbH"'),
    street: z.string(),
    zip: z.string(),
    city: z.string(),
    country: z.string().length(2),
    email: z.string().email(),
    phone: z.string().optional(),
    managingDirectors: z.array(z.string()).default([]).describe('Geschäftsführer / Vertretungsberechtigte'),
    registerCourt: z.string().optional().describe('Registergericht, e.g. "Amtsgericht München"'),
    registerNumber: z.string().optional().describe('e.g. "HRB 123456"'),
    vatId: z.string().optional().describe('USt-IdNr. (§ 27a UStG)'),
    taxNumber: z.string().optional(),
    responsibleForContent: z.string().optional().describe('Verantwortlich i.S.d. § 18 Abs. 2 MStV'),
    packagingRegisterNo: z.string().optional().describe('LUCID registration (VerpackG)'),
    weeeRegNo: z.string().optional().describe('WEEE-Reg.-Nr. (ElektroG) when selling electronics'),
    disputeResolution: localizedTextSchema.optional().describe('Statement on consumer dispute resolution (VSBG § 36)'),
  })
  .describe('Impressum data (§ 5 DDG)');

export const themeSchema = z.object({
  preset: z.enum(['editorial', 'tech', 'minimal', 'warm', 'bold']).default('editorial'),
  colors: z
    .object({
      background: hex.default('#ffffff'),
      foreground: hex.default('#0f172a'),
      muted: hex.default('#f1f5f9'),
      mutedForeground: hex.default('#64748b'),
      border: hex.default('#e2e8f0'),
      primary: hex.default('#1e3a8a'),
      primaryForeground: hex.default('#ffffff'),
      accent: hex.default('#f59e0b'),
      accentForeground: hex.default('#1f2937'),
      success: hex.default('#15803d'),
      danger: hex.default('#b91c1c'),
    })
    .prefault({}),
  radius: z.string().default('0.75rem'),
  fonts: z.object({ heading: z.string().default('Fraunces'), body: z.string().default('Inter') }).prefault({}),
  logo: z.object({ text: z.string(), src: z.string().optional(), mark: z.string().optional() }),
});

const sectionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hero'), title: localizedTextSchema, subtitle: localizedTextSchema.optional(), cta: z.object({ label: localizedTextSchema, href: z.string() }).optional(), secondaryCta: z.object({ label: localizedTextSchema, href: z.string() }).optional(), image: z.string().optional(), diagram: z.string().optional().describe('Diagram scene id rendered live in the hero') }),
  z.object({ type: z.literal('kinds'), title: localizedTextSchema, kinds: z.array(productKindSchema).optional() }),
  z.object({ type: z.literal('categories'), title: localizedTextSchema }),
  z.object({ type: z.literal('products'), title: localizedTextSchema, query: z.object({ kind: productKindSchema.optional(), category: z.string().optional(), featured: z.boolean().optional(), sort: z.enum(['newest', 'price_asc', 'price_desc', 'title']).optional(), limit: z.number().int().positive().max(24).default(8) }) }),
  z.object({ type: z.literal('usp'), items: z.array(z.object({ icon: z.string(), title: localizedTextSchema, text: localizedTextSchema })) }),
  z.object({ type: z.literal('banner'), title: localizedTextSchema, text: localizedTextSchema.optional(), cta: z.object({ label: localizedTextSchema, href: z.string() }).optional(), image: z.string().optional(), tone: z.enum(['primary', 'accent', 'muted']).default('primary') }),
  z.object({ type: z.literal('diagram'), title: localizedTextSchema, text: localizedTextSchema.optional(), diagram: z.string() }),
]);
export type HomeSection = z.infer<typeof sectionSchema>;

export const paymentProviderSchema = z.discriminatedUnion('id', [
  z.object({ id: z.literal('mock'), enabled: z.boolean().default(true) }),
  z.object({
    id: z.literal('stripe'),
    enabled: z.boolean().default(true),
    /** Stripe payment method types — DACH favourites by default */
    methods: z.array(z.string()).default(['card', 'paypal', 'klarna', 'sepa_debit', 'eps', 'twint']),
  }),
  z.object({
    id: z.literal('prepayment'),
    enabled: z.boolean().default(true),
    bank: z.object({ accountHolder: z.string(), iban: z.string(), bic: z.string().optional(), bankName: z.string().optional() }),
  }),
]);

export const storeConfigSchema = z.object({
  $schema: z.string().optional(),
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  tagline: localizedTextSchema.default({}),
  url: z.string().url().default('http://localhost:3000'),
  locales: z.object({ default: localeSchema.default('de'), supported: z.array(localeSchema).min(1).default(['de', 'en']) }).prefault({}),
  markets: z
    .array(z.object({ country: z.string().length(2), currency, default: z.boolean().optional() }))
    .min(1)
    .default([
      { country: 'DE', currency: 'EUR', default: true },
      { country: 'AT', currency: 'EUR' },
      { country: 'CH', currency: 'CHF' },
    ]),
  legal: legalEntitySchema,
  tax: z
    .object({
      originCountry: z.string().length(2).default('DE'),
      oss: z.boolean().default(true),
      registrations: z.array(z.string().length(2)).default([]),
      smallBusiness: z.boolean().default(false),
      priceStrategy: z.enum(['gross-constant', 'net-constant']).default('gross-constant'),
      rateOverrides: z.record(z.string(), z.partialRecord(taxCategorySchema, z.number().int().nonnegative())).optional(),
    })
    .prefault({}),
  catalog: z
    .object({
      enabledKinds: z.array(productKindSchema).min(1),
      /** Treat new books/e-books as price-bound (Buchpreisbindung) unless the product says otherwise */
      priceBindingDefault: z.boolean().default(true),
      lowStockThreshold: z.number().int().nonnegative().default(5),
    }),
  shipping: z.object({ zones: z.array(shippingZoneSchema) }).default({ zones: [] }),
  payments: z.object({ providers: z.array(paymentProviderSchema).min(1) }),
  orders: z.object({ numberPrefix: z.string().regex(/^[A-Z0-9]{1,6}$/).default('SF') }).prefault({}),
  features: z
    .object({
      guestCheckout: z.boolean().default(true),
      reviews: z.boolean().default(true),
      wishlist: z.boolean().default(true),
      b2b: z.boolean().default(true).describe('Allow company customers with VAT ID (reverse charge)'),
      marketplace: z.boolean().default(false).describe('Multi-vendor: third-party sellers with commission'),
    })
    .prefault({}),
  theme: themeSchema,
  design: z
    .object({
      source: z.enum(['local', 'canva']).default('local'),
      canva: z
        .object({
          brandKitId: z.string().optional(),
          /** Canva design ids → exported into stores/<id>/assets by `pnpm factory canva:pull` */
          assets: z.array(z.object({ designId: z.string(), output: z.string(), format: z.enum(['png', 'jpg', 'pdf']).default('png') })).default([]),
        })
        .optional(),
    })
    .prefault({}),
  /**
   * Native iOS / Android apps (apps/mobile). Bundle ids must be unique per store.
   * digitalGoodsInNativeApps: Apple (App Review 3.1.1) and Google Play require their own
   * billing for digital content bought inside an app. Options:
   *   web-checkout — digital items open the website checkout in the browser (allowed for
   *                  EU storefronts under the DMA and US storefronts; check your markets)
   *   browse-only  — digital items can be browsed and read ("reader app"), not bought in-app
   * Physical goods and real-world services (consulting) may always use the shop's own checkout.
   */
  apps: z
    .object({
      scheme: z.string().regex(/^[a-z][a-z0-9+.-]*$/).optional(),
      ios: z.object({ bundleId: z.string() }).optional(),
      android: z.object({ package: z.string() }).optional(),
      digitalGoodsInNativeApps: z.enum(['web-checkout', 'browse-only']).default('web-checkout'),
    })
    .prefault({}),
  home: z.object({ sections: z.array(sectionSchema) }),
  seo: z.object({ titleTemplate: z.string().default('%s | {store}'), description: localizedTextSchema.default({}) }).prefault({}),
});

export type StoreConfig = z.infer<typeof storeConfigSchema>;
export type StoreConfigInput = z.input<typeof storeConfigSchema>;

/* ---------- catalog seed files (stores/<id>/catalog/*.json) ---------- */

export const categorySeedSchema = z.object({
  slug: z.string(),
  parent: z.string().optional(),
  name: localizedTextSchema,
  description: localizedTextSchema.optional(),
  image: z.string().optional(),
  position: z.number().int().default(0),
});
export type CategorySeed = z.infer<typeof categorySeedSchema>;

export const variantSeedSchema = z.object({
  sku: z.string(),
  title: localizedTextSchema.optional(),
  options: z.record(z.string(), z.string()).default({}),
  prices: z.partialRecord(currency, z.number().int().nonnegative()),
  compareAt: z.partialRecord(currency, z.number().int().nonnegative()).optional(),
  stock: z.number().int().nonnegative().optional().describe('omit = not tracked (unlimited)'),
  weightGrams: z.number().int().nonnegative().default(0),
  unitMeasure: unitMeasureSchema.optional(),
  billing: billingSchema.optional(),
});

export const serviceSlotSeedSchema = z.object({ startsAt: z.string(), durationMinutes: z.number().int().positive(), capacity: z.number().int().positive().default(1) });

export const productSeedSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  kind: productKindSchema,
  status: z.enum(['draft', 'active', 'archived']).default('active'),
  featured: z.boolean().default(false),
  categories: z.array(z.string()).default([]),
  title: localizedTextSchema,
  subtitle: localizedTextSchema.optional(),
  description: localizedTextSchema,
  taxCategory: taxCategorySchema.optional(),
  priceBound: z.boolean().optional(),
  brand: z.string().optional(),
  seller: z.string().optional(),
  images: z.array(z.object({ src: z.string(), alt: localizedTextSchema.optional() })).default([]),
  attributes: z.record(z.string(), z.unknown()).default({}),
  variants: z.array(variantSeedSchema).min(1),
  slots: z.array(serviceSlotSeedSchema).optional().describe('bookable slots for kind=service; relative "+3d10:00" or ISO'),
  tags: z.array(z.string()).default([]),
});
export type ProductSeed = z.infer<typeof productSeedSchema>;

export const catalogSeedSchema = z.object({
  categories: z.array(categorySeedSchema).default([]),
  products: z.array(productSeedSchema).default([]),
  coupons: z.array(couponSchema).default([]),
  sellers: z.array(z.object({ slug: z.string(), name: z.string(), commissionBps: z.number().int().nonnegative().default(1500) })).default([]),
});
export type CatalogSeed = z.infer<typeof catalogSeedSchema>;
