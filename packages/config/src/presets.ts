import type { ProductKind } from '@factory/core';
import type { CatalogSeed, StoreConfigInput } from './schema.js';

/**
 * STORE PRESETS
 * =============
 * A preset is a starting point for `pnpm factory create <id> --preset <preset>`.
 * It decides the enabled product kinds, theme, home layout and a small demo
 * catalog. Everything can be edited afterwards in the generated store folder.
 */

export interface PresetInput {
  id: string;
  name: string;
  company?: string;
  email?: string;
}

export interface Preset {
  id: string;
  description: { de: string; en: string };
  kinds: ProductKind[];
  build(input: PresetInput): { config: StoreConfigInput; catalog: CatalogSeed };
}

const DACH_SHIPPING = {
  zones: [
    {
      id: 'de',
      name: { de: 'Deutschland', en: 'Germany' },
      countries: ['DE'],
      rates: [
        { id: 'dhl', name: { de: 'DHL Paket', en: 'DHL parcel' }, carrier: 'DHL', price: { EUR: 495 }, freeAbove: { EUR: 4900 }, minDays: 1, maxDays: 3 },
        { id: 'dhl-express', name: { de: 'DHL Express', en: 'DHL Express' }, carrier: 'DHL', price: { EUR: 1490 }, minDays: 1, maxDays: 1 },
      ],
    },
    {
      id: 'at',
      name: { de: 'Österreich', en: 'Austria' },
      countries: ['AT'],
      rates: [{ id: 'dhl-at', name: { de: 'DHL Paket Österreich', en: 'DHL parcel Austria' }, carrier: 'DHL', price: { EUR: 890 }, freeAbove: { EUR: 7900 }, minDays: 2, maxDays: 4 }],
    },
    {
      id: 'ch',
      name: { de: 'Schweiz', en: 'Switzerland' },
      countries: ['CH', 'LI'],
      rates: [{ id: 'post-ch', name: { de: 'Die Post (verzollt)', en: 'Swiss Post (duty paid)' }, carrier: 'Post CH', price: { CHF: 1490, EUR: 1490 }, minDays: 3, maxDays: 6 }],
    },
    {
      id: 'eu',
      name: { de: 'EU', en: 'EU' },
      countries: ['BE', 'NL', 'LU', 'FR', 'IT', 'ES', 'PL', 'CZ', 'DK', 'SE', 'FI', 'IE', 'PT'],
      rates: [{ id: 'dhl-eu', name: { de: 'DHL Paket International', en: 'DHL parcel international' }, carrier: 'DHL', price: { EUR: 1290 }, minDays: 3, maxDays: 7 }],
    },
  ],
};

function base(input: PresetInput, over: Partial<StoreConfigInput> & Pick<StoreConfigInput, 'catalog' | 'theme' | 'home'>): StoreConfigInput {
  return {
    $schema: '../../packages/config/store.schema.json',
    id: input.id,
    name: input.name,
    url: 'http://localhost:3000',
    locales: { default: 'de', supported: ['de', 'en'] },
    markets: [
      { country: 'DE', currency: 'EUR', default: true },
      { country: 'AT', currency: 'EUR' },
      { country: 'CH', currency: 'CHF' },
    ],
    legal: {
      company: input.company ?? `${input.name} GmbH`,
      street: 'Musterstraße 1',
      zip: '10115',
      city: 'Berlin',
      country: 'DE',
      email: input.email ?? 'hallo@example.com',
      managingDirectors: ['Max Mustermann'],
      registerCourt: 'Amtsgericht Charlottenburg',
      registerNumber: 'HRB 000000',
      vatId: 'DE000000000',
    },
    tax: { originCountry: 'DE', oss: true, registrations: [], smallBusiness: false, priceStrategy: 'gross-constant' },
    shipping: DACH_SHIPPING,
    payments: { providers: [{ id: 'mock', enabled: true }, { id: 'prepayment', enabled: true, bank: { accountHolder: input.company ?? `${input.name} GmbH`, iban: 'DE02120300000000202051', bic: 'BYLADEM1001' } }] },
    orders: { numberPrefix: input.id.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'SF' },
    ...over,
  };
}

const usp = (items: [string, string, string, string, string][]) => ({
  type: 'usp' as const,
  items: items.map(([icon, de, en, tde, ten]) => ({ icon, title: { de, en }, text: { de: tde, en: ten } })),
});

export const PRESETS: Record<string, Preset> = {
  general: {
    id: 'general',
    description: { de: 'Vollsortimenter: Bücher, Digitales, Elektronik, Kurse, Beratung', en: 'Generalist: books, digital, electronics, courses, consulting' },
    kinds: ['physical', 'book', 'ebook', 'interactive_book', 'digital_download', 'license', 'subscription', 'course', 'service'],
    build(input) {
      return {
        config: base(input, {
          catalog: { enabledKinds: this.kinds, priceBindingDefault: true },
          theme: { preset: 'editorial', logo: { text: input.name } },
          home: {
            sections: [
              { type: 'hero', title: { de: `Willkommen bei ${input.name}`, en: `Welcome to ${input.name}` }, subtitle: { de: 'Alles, was Wissen und Arbeit besser macht.', en: 'Everything that makes knowledge and work better.' }, cta: { label: { de: 'Jetzt entdecken', en: 'Explore now' }, href: '/products' } },
              { type: 'kinds', title: { de: 'Unser Sortiment', en: 'Our range' } },
              { type: 'products', title: { de: 'Empfehlungen', en: 'Featured' }, query: { featured: true, limit: 8 } },
              usp([
                ['truck', 'Versand aus Deutschland', 'Shipped from Germany', 'Kostenlos ab 49 €', 'Free from €49'],
                ['shield', 'Sicher bezahlen', 'Secure payment', 'PayPal, Klarna, SEPA, Karte', 'PayPal, Klarna, SEPA, card'],
                ['undo', '14 Tage Widerruf', '14-day returns', 'Gesetzliches Widerrufsrecht', 'Statutory right of withdrawal'],
              ]),
            ],
          },
        }),
        catalog: demoCatalog(['physical', 'book', 'ebook', 'course', 'service']),
      };
    },
  },
  bookstore: {
    id: 'bookstore',
    description: { de: 'Buchhandlung mit Buchpreisbindung, E-Books und interaktiven 3D-Ausgaben', en: 'Bookstore with fixed book prices, e-books and interactive 3D editions' },
    kinds: ['book', 'ebook', 'interactive_book', 'subscription'],
    build(input) {
      return {
        config: base(input, {
          catalog: { enabledKinds: this.kinds, priceBindingDefault: true },
          theme: { preset: 'editorial', colors: { primary: '#7c2d12', accent: '#d97706', background: '#fffbf5', muted: '#f5efe6', border: '#e7dccb' }, fonts: { heading: 'Fraunces', body: 'Inter' }, logo: { text: input.name } },
          home: {
            sections: [
              { type: 'hero', title: { de: 'Bücher, die man begreifen kann', en: 'Books you can grasp' }, subtitle: { de: 'Gedruckt, digital und als interaktive 3D-Ausgabe.', en: 'In print, digital and as interactive 3D editions.' }, cta: { label: { de: 'Zum Sortiment', en: 'Browse books' }, href: '/products?kind=book' } },
              { type: 'products', title: { de: 'Neuerscheinungen', en: 'New releases' }, query: { kind: 'book', sort: 'newest', limit: 8 } },
              usp([
                ['book', 'Buchpreisbindung', 'Fixed book prices', 'Überall derselbe Preis', 'Same price everywhere'],
                ['truck', 'Versandkostenfrei', 'Free shipping', 'Bücher versandkostenfrei in DE', 'Free book shipping in Germany'],
              ]),
            ],
          },
        }),
        catalog: demoCatalog(['book', 'ebook']),
      };
    },
  },
  electronics: {
    id: 'electronics',
    description: { de: 'Elektronik-Shop mit GPSR-/WEEE-Angaben, Varianten und Lagerbestand', en: 'Electronics shop with GPSR/WEEE data, variants and stock' },
    kinds: ['physical', 'license', 'service'],
    build(input) {
      return {
        config: base(input, {
          catalog: { enabledKinds: this.kinds, priceBindingDefault: false },
          theme: { preset: 'tech', colors: { primary: '#0f172a', accent: '#22d3ee', accentForeground: '#0f172a' }, fonts: { heading: 'Space Grotesk', body: 'Inter' }, logo: { text: input.name } },
          home: {
            sections: [
              { type: 'hero', title: { de: 'Technik, die einfach funktioniert', en: 'Tech that just works' }, cta: { label: { de: 'Zu den Produkten', en: 'Shop now' }, href: '/products' } },
              { type: 'products', title: { de: 'Bestseller', en: 'Bestsellers' }, query: { kind: 'physical', limit: 8 } },
            ],
          },
        }),
        catalog: demoCatalog(['physical']),
      };
    },
  },
  digital: {
    id: 'digital',
    description: { de: 'Digitale Produkte, Software-Lizenzen und SaaS-Abos', en: 'Digital products, software licences and SaaS subscriptions' },
    kinds: ['digital_download', 'license', 'subscription', 'ebook'],
    build(input) {
      return {
        config: base(input, {
          catalog: { enabledKinds: this.kinds, priceBindingDefault: false },
          shipping: { zones: [] },
          theme: { preset: 'minimal', colors: { primary: '#4338ca', accent: '#10b981' }, fonts: { heading: 'Inter', body: 'Inter' }, logo: { text: input.name } },
          home: { sections: [{ type: 'hero', title: { de: 'Werkzeuge für Macher', en: 'Tools for makers' }, cta: { label: { de: 'Entdecken', en: 'Discover' }, href: '/products' } }, { type: 'products', title: { de: 'Beliebt', en: 'Popular' }, query: { limit: 8 } }] },
        }),
        catalog: demoCatalog(['digital_download', 'ebook']),
      };
    },
  },
  academy: {
    id: 'academy',
    description: { de: 'Online-Akademie: Kurse, Abos und Coaching', en: 'Online academy: courses, memberships and coaching' },
    kinds: ['course', 'subscription', 'service', 'ebook'],
    build(input) {
      return {
        config: base(input, {
          catalog: { enabledKinds: this.kinds, priceBindingDefault: false },
          shipping: { zones: [] },
          theme: { preset: 'warm', colors: { primary: '#9d174d', accent: '#f59e0b' }, fonts: { heading: 'Fraunces', body: 'Inter' }, logo: { text: input.name } },
          home: { sections: [{ type: 'hero', title: { de: 'Lernen, das bleibt', en: 'Learning that sticks' }, cta: { label: { de: 'Kurse ansehen', en: 'View courses' }, href: '/products?kind=course' } }, { type: 'products', title: { de: 'Kurse', en: 'Courses' }, query: { kind: 'course', limit: 8 } }] },
        }),
        catalog: demoCatalog(['course', 'service']),
      };
    },
  },
  consulting: {
    id: 'consulting',
    description: { de: 'Beratung & Dienstleistungen mit buchbaren Terminen', en: 'Consulting & services with bookable slots' },
    kinds: ['service', 'digital_download'],
    build(input) {
      return {
        config: base(input, {
          catalog: { enabledKinds: this.kinds, priceBindingDefault: false },
          shipping: { zones: [] },
          theme: { preset: 'bold', colors: { primary: '#064e3b', accent: '#a3e635', accentForeground: '#1a2e05' }, fonts: { heading: 'Space Grotesk', body: 'Inter' }, logo: { text: input.name } },
          home: { sections: [{ type: 'hero', title: { de: 'Expertise auf Abruf', en: 'Expertise on demand' }, cta: { label: { de: 'Termin buchen', en: 'Book a session' }, href: '/products?kind=service' } }, { type: 'products', title: { de: 'Leistungen', en: 'Services' }, query: { kind: 'service', limit: 8 } }] },
        }),
        catalog: demoCatalog(['service']),
      };
    },
  },
  marketplace: {
    id: 'marketplace',
    description: { de: 'Marktplatz mit Drittanbietern und Provision', en: 'Multi-vendor marketplace with commissions' },
    kinds: ['physical', 'book', 'ebook', 'digital_download', 'service'],
    build(input) {
      const catalog = demoCatalog(['physical', 'book']);
      catalog.sellers.push({ slug: 'partner-one', name: 'Partner One GmbH', commissionBps: 1200 });
      catalog.products.forEach((p) => (p.seller = 'partner-one'));
      return {
        config: base(input, {
          catalog: { enabledKinds: this.kinds, priceBindingDefault: true },
          features: { marketplace: true, guestCheckout: true, reviews: true, wishlist: true, b2b: true },
          theme: { preset: 'bold', colors: { primary: '#b91c1c', accent: '#facc15', accentForeground: '#1f2937' }, fonts: { heading: 'Inter', body: 'Inter' }, logo: { text: input.name } },
          home: { sections: [{ type: 'hero', title: { de: 'Alles von Händlern, denen du vertraust', en: 'Everything from sellers you trust' }, cta: { label: { de: 'Stöbern', en: 'Browse' }, href: '/products' } }, { type: 'categories', title: { de: 'Kategorien', en: 'Categories' } }, { type: 'products', title: { de: 'Angesagt', en: 'Trending' }, query: { limit: 8 } }] },
        }),
        catalog,
      };
    },
  },
};

/** Tiny demo catalog so a fresh store is immediately browsable. */
function demoCatalog(kinds: ProductKind[]): CatalogSeed {
  const c: CatalogSeed = { categories: [], products: [], coupons: [{ code: 'WILLKOMMEN10', type: 'percent', value: 1000, usedCount: 0, active: true }], sellers: [] };
  const cat = (slug: string, de: string, en: string) => c.categories.push({ slug, name: { de, en }, position: c.categories.length });
  const prices = (eur: number) => ({ EUR: eur, CHF: Math.round((eur * 1.05) / 10) * 10 });

  if (kinds.includes('book')) {
    cat('buecher', 'Bücher', 'Books');
    c.products.push({ slug: 'demo-fachbuch', kind: 'book', status: 'active', featured: true, categories: ['buecher'], title: { de: 'Das Demo-Fachbuch', en: 'The Demo Handbook' }, description: { de: 'Ein Beispielbuch für deinen neuen Shop.', en: 'A sample book for your new store.' }, priceBound: true, images: [], attributes: { authors: ['Erika Musterfrau'], pages: 320, binding: 'paperback', language: 'de' }, variants: [{ sku: 'BOOK-DEMO-1', prices: prices(2990), stock: 50, weightGrams: 600, options: {} }], tags: [] });
  }
  if (kinds.includes('ebook')) {
    cat('e-books', 'E-Books', 'E-books');
    c.products.push({ slug: 'demo-ebook', kind: 'ebook', status: 'active', featured: true, categories: ['e-books'], title: { de: 'Das Demo-E-Book', en: 'The Demo E-book' }, description: { de: 'Sofort lesbar als EPUB und PDF.', en: 'Read instantly as EPUB and PDF.' }, priceBound: true, images: [], attributes: { authors: ['Erika Musterfrau'], files: [{ key: 'demo-ebook.epub', name: 'demo-ebook.epub', format: 'epub' }] }, variants: [{ sku: 'EBOOK-DEMO-1', prices: prices(1999), weightGrams: 0, options: {} }], tags: [] });
  }
  if (kinds.includes('physical')) {
    cat('technik', 'Technik', 'Tech');
    c.products.push({ slug: 'demo-kopfhoerer', kind: 'physical', status: 'active', featured: true, categories: ['technik'], title: { de: 'Demo-Kopfhörer', en: 'Demo headphones' }, description: { de: 'Kabellos, mit aktiver Geräuschunterdrückung.', en: 'Wireless with active noise cancelling.' }, images: [], brand: 'Demo', attributes: { brand: 'Demo', warrantyMonths: 24, gpsr: { manufacturer: 'Demo Audio GmbH', address: 'Musterstraße 1, 10115 Berlin' } }, variants: [{ sku: 'HP-DEMO-BLK', options: { Farbe: 'Schwarz' }, prices: prices(12900), stock: 25, weightGrams: 350 }, { sku: 'HP-DEMO-WHT', options: { Farbe: 'Weiß' }, prices: prices(12900), stock: 3, weightGrams: 350 }], tags: [] });
  }
  if (kinds.includes('digital_download')) {
    cat('downloads', 'Downloads', 'Downloads');
    c.products.push({ slug: 'demo-vorlagen', kind: 'digital_download', status: 'active', featured: true, categories: ['downloads'], title: { de: 'Vorlagen-Paket', en: 'Template pack' }, description: { de: '50 Vorlagen zum sofortigen Download.', en: '50 templates for instant download.' }, images: [], attributes: { files: [{ key: 'templates.zip', name: 'templates.zip', format: 'zip' }] }, variants: [{ sku: 'DL-DEMO-1', prices: prices(2900), weightGrams: 0, options: {} }], tags: [] });
  }
  if (kinds.includes('course')) {
    cat('kurse', 'Kurse', 'Courses');
    c.products.push({ slug: 'demo-kurs', kind: 'course', status: 'active', featured: true, categories: ['kurse'], title: { de: 'Demo-Onlinekurs', en: 'Demo online course' }, description: { de: 'Lerne in deinem Tempo.', en: 'Learn at your own pace.' }, images: [], attributes: { level: 'beginner', modules: [{ id: 'm1', title: { de: 'Einführung', en: 'Introduction' }, lessons: [{ id: 'l1', title: { de: 'Willkommen', en: 'Welcome' }, durationMinutes: 5, preview: true }] }] }, variants: [{ sku: 'COURSE-DEMO-1', prices: prices(9900), weightGrams: 0, options: {} }], tags: [] });
  }
  if (kinds.includes('service')) {
    cat('beratung', 'Beratung', 'Consulting');
    c.products.push({ slug: 'demo-beratung', kind: 'service', status: 'active', featured: true, categories: ['beratung'], title: { de: 'Beratung (60 Min.)', en: 'Consultation (60 min)' }, description: { de: 'Persönliche Videoberatung.', en: 'Personal video consultation.' }, images: [], attributes: { durationMinutes: 60, location: 'online' }, variants: [{ sku: 'SRV-DEMO-60', prices: prices(15000), weightGrams: 0, options: {} }], slots: [{ startsAt: '+2d10:00', durationMinutes: 60, capacity: 1 }, { startsAt: '+3d14:00', durationMinutes: 60, capacity: 1 }], tags: [] });
  }
  return c;
}
