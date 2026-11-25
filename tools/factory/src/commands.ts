import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRESETS, StoreConfigError, catalogSeedSchema, findRepoRoot, loadStore, storeConfigSchema } from '@factory/config';
import { PRODUCT_KINDS, kindDef, type ProductKind } from '@factory/core';

export interface Io {
  log(msg: string): void;
  root: string;
}

const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
export const storesDir = (io: Io) => join(io.root, 'stores');

/* --------------------------------- create --------------------------------- */

export interface CreateOptions {
  id: string;
  preset: string;
  name?: string;
  company?: string;
  email?: string;
  /** clone an existing store instead of using a preset */
  from?: string;
  force?: boolean;
}

export function createStore(io: Io, o: CreateOptions): string {
  if (!/^[a-z0-9-]+$/.test(o.id)) throw new Error('store id must be lowercase letters, digits and dashes');
  const dir = join(storesDir(io), o.id);
  if (existsSync(dir) && !o.force) throw new Error(`stores/${o.id} already exists (use --force to overwrite)`);

  if (o.from) {
    const src = join(storesDir(io), o.from);
    if (!existsSync(src)) throw new Error(`source store stores/${o.from} not found`);
    cpSync(src, dir, { recursive: true });
    const cfg = JSON.parse(readFileSync(join(dir, 'store.json'), 'utf8'));
    cfg.id = o.id;
    if (o.name) cfg.name = cfg.theme.logo.text = o.name;
    writeFileSync(join(dir, 'store.json'), json(cfg));
    io.log(`✔ cloned stores/${o.from} → stores/${o.id}`);
    return dir;
  }

  const preset = PRESETS[o.preset];
  if (!preset) throw new Error(`unknown preset "${o.preset}". Available: ${Object.keys(PRESETS).join(', ')}`);
  const name = o.name ?? o.id.replace(/(^|-)(\w)/g, (_, s: string, c: string) => (s ? ' ' : '') + c.toUpperCase());
  const { config, catalog } = preset.build({ id: o.id, name, company: o.company, email: o.email });

  // validate before writing anything
  storeConfigSchema.parse(config);
  catalogSeedSchema.parse(catalog);

  mkdirSync(join(dir, 'catalog'), { recursive: true });
  mkdirSync(join(dir, 'diagrams'), { recursive: true });
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'store.json'), json(config));
  writeFileSync(join(dir, 'catalog', '00-demo.json'), json({ $schema: '../../../packages/config/catalog.schema.json', ...catalog }));
  writeFileSync(join(dir, 'assets', '.gitkeep'), '');

  // legal templates (placeholders are filled from store.json at runtime)
  const templates = join(io.root, 'tools', 'factory', 'templates', 'content');
  cpSync(templates, join(dir, 'content'), { recursive: true });

  if (preset.kinds.includes('interactive_book')) {
    cpSync(join(io.root, 'tools', 'factory', 'templates', 'diagrams', 'starter.json'), join(dir, 'diagrams', 'starter.json'));
  }
  writeFileSync(join(dir, 'README.md'), storeReadme(o.id, name, preset.id));
  io.log(`✔ created stores/${o.id} from preset "${preset.id}"`);
  io.log(`  next: pnpm factory validate ${o.id} && STORE=${o.id} pnpm dev`);
  return dir;
}

function storeReadme(id: string, name: string, preset: string) {
  return `# ${name}

Created with \`pnpm factory create ${id} --preset ${preset}\`.

| File | Purpose |
| --- | --- |
| \`store.json\` | Identity, legal entity (Impressum), markets, tax, shipping, payments, theme, home layout |
| \`catalog/*.json\` | Categories, products, coupons, sellers (merged in file-name order) |
| \`diagrams/*.json\` | Interactive 3D diagram scenes for interactive books |
| \`content/<locale>/*.md\` | Legal & content pages with \`{{legal.*}}\` placeholders |
| \`assets/\` | Images (local or pulled from Canva via \`pnpm factory canva:pull ${id}\`) |

Run: \`STORE=${id} pnpm dev\` · Validate: \`pnpm factory validate ${id}\` · Re-seed: \`STORE=${id} pnpm db:seed\`
`;
}

/* -------------------------------- validate -------------------------------- */

export function validateStore(io: Io, id: string): boolean {
  const dir = join(storesDir(io), id);
  try {
    const s = loadStore(dir);
    const kinds = new Map<string, number>();
    for (const p of s.catalog.products) kinds.set(p.kind, (kinds.get(p.kind) ?? 0) + 1);
    io.log(`✔ stores/${id} is valid — ${s.catalog.products.length} products (${[...kinds].map(([k, n]) => `${n} ${k}`).join(', ')}), ${s.catalog.categories.length} categories, ${s.diagrams.size} diagrams`);
    const warnings: string[] = [];
    if (s.config.legal.vatId?.endsWith('000000000')) warnings.push('legal.vatId is still a placeholder');
    if (s.config.legal.company.includes('Platzhalter') || s.config.legal.street === 'Musterstraße 1') warnings.push('legal entity data is still a placeholder (Impressum!)');
    if (s.config.payments.providers.every((p) => p.id === 'mock' || !p.enabled)) warnings.push('only the mock payment provider is enabled');
    for (const l of s.config.locales.supported) if (!existsSync(join(dir, 'content', l))) warnings.push(`no content pages for locale "${l}"`);
    for (const w of warnings) io.log(`  ⚠ ${w}`);
    return true;
  } catch (e) {
    io.log(`✖ ${e instanceof StoreConfigError ? e.message : String(e)}`);
    return false;
  }
}

export function listStores(io: Io): string[] {
  if (!existsSync(storesDir(io))) return [];
  return readdirSync(storesDir(io), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(storesDir(io), d.name, 'store.json')))
    .map((d) => d.name);
}

/* -------------------------------- scaffolds ------------------------------- */

const ATTRIBUTE_SKELETONS: Record<ProductKind, Record<string, unknown>> = {
  physical: { brand: '', warrantyMonths: 24, specs: {}, gpsr: { manufacturer: '', address: '' } },
  book: { isbn: '', authors: [''], publisher: '', pages: 0, binding: 'paperback', language: 'de' },
  ebook: { isbn: '', authors: [''], files: [{ key: 'my-ebook.epub', name: 'my-ebook.epub', format: 'epub' }], watermark: true },
  interactive_book: { authors: [''], diagrams: [], previewDiagram: '', chapters: [] },
  digital_download: { files: [{ key: 'file.zip', name: 'file.zip' }] },
  license: { platforms: ['Windows', 'macOS'], seats: 1, keyPrefix: 'KEY' },
  subscription: { benefits: [{ de: '', en: '' }], grantsAccessTo: [] },
  course: { level: 'beginner', certificate: true, modules: [{ id: 'm1', title: { de: 'Modul 1', en: 'Module 1' }, lessons: [{ id: 'l1', title: { de: 'Lektion 1', en: 'Lesson 1' }, durationMinutes: 10, preview: true }] }] },
  service: { durationMinutes: 60, location: 'online', bookingRequired: true },
};

export function newProduct(io: Io, store: string, kind: string, slug: string): void {
  if (!(PRODUCT_KINDS as string[]).includes(kind)) throw new Error(`unknown kind "${kind}". Kinds: ${PRODUCT_KINDS.join(', ')}`);
  const k = kind as ProductKind;
  const file = join(storesDir(io), store, 'catalog', '90-drafts.json');
  const data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { $schema: '../../../packages/config/catalog.schema.json', products: [] };
  const variant: Record<string, unknown> = { sku: slug.toUpperCase().slice(0, 24), prices: { EUR: 1000, CHF: 1100 } };
  if (kindDef(k).requiresShipping) Object.assign(variant, { stock: 10, weightGrams: 500 });
  if (k === 'subscription') variant.billing = { interval: 'month', intervalCount: 1 };
  data.products.push({
    slug,
    kind: k,
    status: 'draft',
    categories: [],
    title: { de: 'Neuer Titel', en: 'New title' },
    description: { de: 'Beschreibung', en: 'Description' },
    attributes: ATTRIBUTE_SKELETONS[k],
    variants: [variant],
    ...(k === 'service' ? { slots: [{ startsAt: '+3d10:00', durationMinutes: 60 }] } : {}),
  });
  writeFileSync(file, json(data));
  io.log(`✔ added draft ${k} "${slug}" to stores/${store}/catalog/90-drafts.json (status: draft)`);
}

export function newDiagram(io: Io, store: string, id: string): void {
  const file = join(storesDir(io), store, 'diagrams', `${id}.json`);
  if (existsSync(file)) throw new Error(`${file} exists`);
  const tpl = JSON.parse(readFileSync(join(io.root, 'tools', 'factory', 'templates', 'diagrams', 'starter.json'), 'utf8'));
  tpl.id = id;
  mkdirSync(join(storesDir(io), store, 'diagrams'), { recursive: true });
  writeFileSync(file, json(tpl));
  io.log(`✔ created stores/${store}/diagrams/${id}.json — preview it at /diagrams/${id} in the storefront`);
}

/* ---------------------------------- canva --------------------------------- */

/**
 * Export designs listed in store.json → design.canva.assets via the Canva Connect API
 * (https://www.canva.dev/docs/connect/). Needs CANVA_ACCESS_TOKEN (OAuth, scope design:content:read).
 */
export async function canvaPull(io: Io, store: string, token = process.env.CANVA_ACCESS_TOKEN): Promise<void> {
  if (!token) throw new Error('CANVA_ACCESS_TOKEN is not set (create a Canva Connect integration and authorise it)');
  const dir = join(storesDir(io), store);
  const cfg = JSON.parse(readFileSync(join(dir, 'store.json'), 'utf8'));
  const assets: { designId: string; output: string; format?: string }[] = cfg.design?.canva?.assets ?? [];
  if (!assets.length) return io.log('nothing to pull — add entries to design.canva.assets in store.json');
  const api = 'https://api.canva.com/rest/v1';
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  for (const a of assets) {
    const job = await (await fetch(`${api}/exports`, { method: 'POST', headers, body: JSON.stringify({ design_id: a.designId, format: { type: a.format ?? 'png' } }) })).json() as { job: { id: string; status: string; urls?: string[] } };
    let status = job.job;
    for (let i = 0; i < 30 && status.status === 'in_progress'; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      status = ((await (await fetch(`${api}/exports/${status.id}`, { headers })).json()) as { job: typeof status }).job;
    }
    if (status.status !== 'success' || !status.urls?.[0]) throw new Error(`export of ${a.designId} failed (${status.status})`);
    const bytes = Buffer.from(await (await fetch(status.urls[0])).arrayBuffer());
    const out = join(dir, 'assets', a.output);
    mkdirSync(join(out, '..'), { recursive: true });
    writeFileSync(out, bytes);
    io.log(`✔ ${a.designId} → stores/${store}/assets/${a.output}`);
  }
}

export function defaultIo(): Io {
  return { log: (m) => console.log(m), root: findRepoRoot() };
}
