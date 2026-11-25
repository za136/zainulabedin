import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadStore } from '@factory/config';
import { createDb, migrate, resolveSlotTime, seedStore, type DbHandle } from '../src/index.js';

let h: DbHandle;
const store = loadStore(new URL('../../../stores/wissenswerk', import.meta.url).pathname);

beforeAll(async () => {
  h = await createDb('pglite://memory');
  await migrate(h);
});
afterAll(() => h.close());

describe('seedStore', () => {
  it('is idempotent', async () => {
    await seedStore(h.db, store);
    await seedStore(h.db, store);
    const r = await h.db.execute(sql`select count(*)::int as n from products`);
    expect((r.rows[0] as { n: number }).n).toBe(store.catalog.products.length);
    const v = await h.db.execute(sql`select count(*)::int as n from variants`);
    expect((v.rows[0] as { n: number }).n).toBe(store.catalog.products.reduce((s, p) => s + p.variants.length, 0));
  });

  it('marks books price-bound and imports not', async () => {
    const r = await h.db.execute(sql`select slug, price_bound from products where kind = 'book' order by slug`);
    const rows = r.rows as { slug: string; price_bound: boolean }[];
    expect(rows.find((x) => x.slug === 'designing-data-systems-en')?.price_bound).toBe(false);
    expect(rows.find((x) => x.slug === 'wie-das-internet-funktioniert')?.price_bound).toBe(true);
  });

  it('supports German full-text search', async () => {
    const r = await h.db.execute(sql`select to_tsvector('german', 'Die Bücher wurden gelesen') @@ websearch_to_tsquery('german', 'Buch') as hit`);
    expect((r.rows[0] as { hit: boolean }).hit).toBe(true);
  });
});

describe('resolveSlotTime', () => {
  it('resolves relative slots in Europe/Berlin', () => {
    const d = resolveSlotTime('+1d10:00', new Date('2026-07-01T08:00:00Z'));
    expect(d.toISOString()).toBe('2026-07-02T08:00:00.000Z'); // CEST = UTC+2
    const w = resolveSlotTime('+1d10:00', new Date('2026-01-10T08:00:00Z'));
    expect(w.toISOString()).toBe('2026-01-11T09:00:00.000Z'); // CET = UTC+1
  });
});
