import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { diagramSceneSchema, type DiagramScene, type Locale } from '@factory/core';
import { catalogSeedSchema, storeConfigSchema, type CatalogSeed, type StoreConfig } from './schema.js';

export class StoreConfigError extends Error {
  constructor(message: string, public issues: string[] = []) {
    super(issues.length ? `${message}\n  - ${issues.join('\n  - ')}` : message);
  }
}

/** Walk up from `start` until the monorepo root (pnpm-workspace.yaml) is found. */
export function findRepoRoot(start = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

/**
 * Which store to run. Resolution order:
 *   1. STORE_DIR (absolute or relative path to a store folder)
 *   2. STORE (store id under <repo>/stores)
 *   3. "wissenswerk" (the flagship demo store)
 */
export function resolveStoreDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.STORE_DIR) return resolve(env.STORE_DIR);
  return join(findRepoRoot(), 'stores', env.STORE ?? 'wissenswerk');
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new StoreConfigError(`Cannot read ${path}: ${(e as Error).message}`);
  }
}

function formatIssues(err: { issues: { path: PropertyKey[]; message: string }[] }): string[] {
  return err.issues.map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`);
}

export function loadStoreConfig(storeDir: string): StoreConfig {
  const file = join(storeDir, 'store.json');
  if (!existsSync(file)) throw new StoreConfigError(`No store.json in ${storeDir}`);
  const parsed = storeConfigSchema.safeParse(readJson(file));
  if (!parsed.success) throw new StoreConfigError(`Invalid ${file}`, formatIssues(parsed.error));
  return parsed.data;
}

/** Merge every `catalog/*.json` file (so large catalogs can be split by vertical). */
export function loadCatalog(storeDir: string): CatalogSeed {
  const dir = join(storeDir, 'catalog');
  const merged: CatalogSeed = { categories: [], products: [], coupons: [], sellers: [] };
  if (!existsSync(dir)) return merged;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const parsed = catalogSeedSchema.safeParse(readJson(join(dir, f)));
    if (!parsed.success) throw new StoreConfigError(`Invalid catalog file ${f}`, formatIssues(parsed.error));
    merged.categories.push(...parsed.data.categories);
    merged.products.push(...parsed.data.products);
    merged.coupons.push(...parsed.data.coupons);
    merged.sellers.push(...parsed.data.sellers);
  }
  return merged;
}

export function loadDiagrams(storeDir: string): Map<string, DiagramScene> {
  const dir = join(storeDir, 'diagrams');
  const map = new Map<string, DiagramScene>();
  if (!existsSync(dir)) return map;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const parsed = diagramSceneSchema.safeParse(readJson(join(dir, f)));
    if (!parsed.success) throw new StoreConfigError(`Invalid diagram ${f}`, formatIssues(parsed.error));
    map.set(parsed.data.id, parsed.data);
  }
  return map;
}

/** Content pages (Impressum, AGB, Datenschutz, …) as Markdown: content/<locale>/<slug>.md */
export function loadContentPage(storeDir: string, locale: Locale, slug: string, fallback: Locale = 'de'): { locale: Locale; markdown: string } | undefined {
  if (!/^[a-z0-9-]+$/.test(slug)) return undefined;
  for (const l of [locale, fallback]) {
    const p = join(storeDir, 'content', l, `${slug}.md`);
    if (existsSync(p) && statSync(p).isFile()) return { locale: l, markdown: readFileSync(p, 'utf8') };
  }
  return undefined;
}

/** Canonical legal page keys → per-locale file slugs. Unknown keys are treated as raw slugs. */
export const LEGAL_PAGES: Record<string, Partial<Record<Locale, string>>> = {
  imprint: { de: 'impressum', en: 'imprint' },
  terms: { de: 'agb', en: 'terms' },
  withdrawal: { de: 'widerruf', en: 'withdrawal' },
  privacy: { de: 'datenschutz', en: 'privacy' },
  shipping: { de: 'versand-zahlung', en: 'shipping-payment' },
};

export function loadPage(storeDir: string, key: string, locale: Locale, fallback: Locale = 'de'): { locale: Locale; markdown: string } | undefined {
  const map = LEGAL_PAGES[key];
  if (!map) return loadContentPage(storeDir, locale, key, fallback);
  for (const l of [locale, fallback]) {
    const slug = map[l];
    if (!slug) continue;
    const page = loadContentPage(storeDir, l, slug, l);
    if (page) return page;
  }
  return undefined;
}

/** Fill `{{store.name}}`, `{{legal.company}}` … placeholders in content templates. */
export function renderTemplate(markdown: string, vars: Record<string, unknown>): string {
  return markdown.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    let v: unknown = vars;
    for (const k of path.split('.')) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined;
    if (Array.isArray(v)) return v.join(', ');
    if (v && typeof v === 'object') return Object.values(v as Record<string, string>)[0] ?? '';
    return v == null || v === '' ? '—' : String(v);
  });
}

export function listContentPages(storeDir: string, locale: Locale): string[] {
  const dir = join(storeDir, 'content', locale);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3));
}

export interface LoadedStore {
  dir: string;
  config: StoreConfig;
  catalog: CatalogSeed;
  diagrams: Map<string, DiagramScene>;
}

/**
 * Load and cross-validate a whole store folder (config + catalog + diagrams).
 * Throws StoreConfigError with a list of every problem found.
 */
export function loadStore(storeDir = resolveStoreDir()): LoadedStore {
  const config = loadStoreConfig(storeDir);
  const catalog = loadCatalog(storeDir);
  const diagrams = loadDiagrams(storeDir);
  const problems = crossValidate(config, catalog, diagrams);
  if (problems.length) throw new StoreConfigError(`Store "${config.id}" is inconsistent`, problems);
  return { dir: storeDir, config, catalog, diagrams };
}

export function crossValidate(config: StoreConfig, catalog: CatalogSeed, diagrams: Map<string, DiagramScene>): string[] {
  const problems: string[] = [];
  const cats = new Set(catalog.categories.map((c) => c.slug));
  const slugs = new Set<string>();
  const skus = new Set<string>();
  const currencies = new Set(config.markets.map((m) => m.currency));
  const sellers = new Set(catalog.sellers.map((s) => s.slug));

  if (!config.locales.supported.includes(config.locales.default)) problems.push(`locales.default "${config.locales.default}" is not in locales.supported`);
  for (const c of catalog.categories) if (c.parent && !cats.has(c.parent)) problems.push(`category ${c.slug}: unknown parent ${c.parent}`);

  for (const p of catalog.products) {
    if (slugs.has(p.slug)) problems.push(`duplicate product slug ${p.slug}`);
    slugs.add(p.slug);
    if (!config.catalog.enabledKinds.includes(p.kind)) problems.push(`product ${p.slug}: kind "${p.kind}" not enabled in store.json catalog.enabledKinds`);
    for (const c of p.categories) if (!cats.has(c)) problems.push(`product ${p.slug}: unknown category ${c}`);
    if (p.seller && !sellers.has(p.seller)) problems.push(`product ${p.slug}: unknown seller ${p.seller}`);
    if (p.kind === 'subscription' && p.variants.some((v) => !v.billing)) problems.push(`product ${p.slug}: subscription variants need "billing"`);
    for (const v of p.variants) {
      if (skus.has(v.sku)) problems.push(`duplicate sku ${v.sku}`);
      skus.add(v.sku);
      for (const cur of currencies) if (v.prices[cur] === undefined) problems.push(`product ${p.slug} / ${v.sku}: missing price in ${cur}`);
    }
    const diagramRefs = [...((p.attributes.diagrams as string[] | undefined) ?? []), ...(p.attributes.previewDiagram ? [p.attributes.previewDiagram as string] : [])];
    for (const d of diagramRefs) if (!diagrams.has(d)) problems.push(`product ${p.slug}: unknown diagram ${d}`);
  }
  for (const s of config.home.sections) {
    const d = 'diagram' in s ? s.diagram : undefined;
    if (d && !diagrams.has(d)) problems.push(`home section ${s.type}: unknown diagram ${d}`);
  }
  for (const m of config.markets) {
    if (config.shipping.zones.length && config.catalog.enabledKinds.some((k) => ['physical', 'book'].includes(k))) {
      const zone = config.shipping.zones.find((z) => z.countries.includes(m.country) || z.countries.includes('*'));
      if (!zone) problems.push(`market ${m.country}: no shipping zone`);
      else if (!zone.rates.some((r) => r.price[m.currency] !== undefined)) problems.push(`market ${m.country}: no shipping rate priced in ${m.currency}`);
    }
  }
  return problems;
}
