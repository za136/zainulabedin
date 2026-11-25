import { loadStore, resolveStoreDir } from '@factory/config';
import { createDb, migrate, seedStore, type DbHandle } from '@factory/db';
import { sql } from 'drizzle-orm';
import type { AppContext } from './context.js';
import { loadEnv, type Env } from './env.js';
import { FormatVatValidator, ViesVatValidator } from './modules/checkout/vat.js';
import { ConsoleMailer, type Mailer } from './modules/notifications/mailer.js';
import { buildPaymentRegistry } from './modules/payments/registry.js';
import { hashPassword } from './lib/security.js';
import { id } from '@factory/core';

/**
 * Compose the application context from env + store folder. This is the one place
 * where adapters are chosen (DB driver, mailer, VAT validator, payment providers).
 */
export async function bootstrap(overrides: { env?: Partial<Env>; mailer?: Mailer; now?: () => Date } = {}): Promise<{ ctx: AppContext; handle: DbHandle }> {
  const env = { ...loadEnv(), ...overrides.env } as Env;
  const store = loadStore(env.STORE_DIR ? env.STORE_DIR : resolveStoreDir({ STORE: env.STORE }));
  const handle = await createDb(env.DATABASE_URL ?? `pglite://./.data/${store.config.id}`);
  if (env.AUTO_MIGRATE) await migrate(handle);
  if (env.SEED_ON_BOOT) {
    const r = await handle.db.execute(sql`select count(*)::int as n from products`);
    if (Number((r.rows[0] as { n: number }).n) === 0) await seedStore(handle.db, store);
  }
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    const { schema: s } = await import('@factory/db');
    const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
    await handle.db
      .insert(s.customers)
      .values({ id: id('cus'), email: env.ADMIN_EMAIL.toLowerCase(), passwordHash, role: 'admin', firstName: 'Admin' })
      .onConflictDoNothing();
  }
  const ctx: AppContext = {
    env,
    store,
    db: handle.db,
    payments: buildPaymentRegistry(store.config, env),
    mailer: overrides.mailer ?? new ConsoleMailer(),
    vat: env.VAT_VALIDATION === 'vies' ? new ViesVatValidator() : new FormatVatValidator(),
    now: overrides.now ?? (() => new Date()),
  };
  return { ctx, handle };
}
