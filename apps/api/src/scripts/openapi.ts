/** Writes the OpenAPI spec to apps/api/openapi.json (used by SDK/codegen and other frontends). */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildApp } from '../app.js';
import { bootstrap } from '../bootstrap.js';

const { ctx, handle } = await bootstrap({ env: { DATABASE_URL: 'pglite://memory', LOG_LEVEL: 'silent', SEED_ON_BOOT: false } });
const app = await buildApp(ctx);
await app.ready();
writeFileSync(join(import.meta.dirname, '..', '..', 'openapi.json'), JSON.stringify(app.swagger(), null, 2));
console.log('wrote apps/api/openapi.json');
await app.close();
await handle.close();
