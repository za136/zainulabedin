import { loadStore, resolveStoreDir } from '@factory/config';
import { createDb, migrate } from '../client.js';
import { seedStore } from '../seed.js';

const store = loadStore(resolveStoreDir());
const url = process.env.DATABASE_URL ?? `pglite://./.data/${store.config.id}`;
const handle = await createDb(url);
await migrate(handle);
await seedStore(handle.db, store, { log: (m) => console.log(`✔ ${m}`) });
console.log(`✔ store "${store.config.id}" seeded into ${handle.driver}`);
await handle.close();
