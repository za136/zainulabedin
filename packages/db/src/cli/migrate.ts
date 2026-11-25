import { createDb, migrate } from '../client.js';

const url = process.env.DATABASE_URL ?? 'pglite://./.data/dev';
const handle = await createDb(url);
await migrate(handle);
console.log(`✔ migrated ${handle.driver} database`);
await handle.close();
