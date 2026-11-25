/** pnpm --filter @factory/api admin:create you@example.com 'a-long-password' */
import { sql } from 'drizzle-orm';
import { id } from '@factory/core';
import { schema as s } from '@factory/db';
import { bootstrap } from '../bootstrap.js';
import { hashPassword } from '../lib/security.js';

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 10) {
  console.error('usage: admin:create <email> <password (min 10 chars)>');
  process.exit(1);
}
const { ctx, handle } = await bootstrap({ env: { SEED_ON_BOOT: false, LOG_LEVEL: 'silent' } });
const passwordHash = await hashPassword(password);
const existing = await ctx.db.query.customers.findFirst({ where: sql`lower(${s.customers.email}) = ${email.toLowerCase()}` });
if (existing) await ctx.db.update(s.customers).set({ role: 'admin', passwordHash }).where(sql`id = ${existing.id}`);
else await ctx.db.insert(s.customers).values({ id: id('cus'), email: email.toLowerCase(), passwordHash, role: 'admin' });
console.log(`✔ ${email} is now an admin`);
await handle.close();
