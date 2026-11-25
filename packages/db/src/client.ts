import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema.js';

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbHandle {
  db: Database;
  driver: 'pg' | 'pglite';
  close(): Promise<void>;
}

export const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'drizzle');

/**
 * Create a database handle from a URL.
 *   postgres://user:pass@host:5432/db   → node-postgres pool (production)
 *   pglite://memory                      → in-memory embedded Postgres (tests)
 *   pglite://./.data/wissenswerk         → file-backed embedded Postgres (zero-setup dev)
 */
export async function createDb(url: string): Promise<DbHandle> {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const pool = new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 10) });
    const db = drizzle(pool, { schema }) as unknown as Database;
    return { db, driver: 'pg', close: () => pool.end() };
  }
  if (url.startsWith('pglite://')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const target = url.slice('pglite://'.length);
    let client: InstanceType<typeof PGlite>;
    if (target === 'memory' || target === '') {
      client = new PGlite();
    } else {
      const dir = resolve(target);
      mkdirSync(dirname(dir), { recursive: true });
      client = new PGlite(dir);
    }
    const db = drizzle(client, { schema }) as unknown as Database;
    return { db, driver: 'pglite', close: () => client.close() };
  }
  throw new Error(`Unsupported DATABASE_URL "${url}". Use postgres://… or pglite://memory | pglite://<dir>`);
}

export async function migrate(handle: DbHandle): Promise<void> {
  if (handle.driver === 'pg') {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    await migrate(handle.db as never, { migrationsFolder: MIGRATIONS_DIR });
  } else {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    await migrate(handle.db as never, { migrationsFolder: MIGRATIONS_DIR });
  }
}
