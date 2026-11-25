/**
 * Emits JSON Schemas for store.json, catalog files and diagram scenes so editors
 * (VS Code, JetBrains) give autocompletion + validation while editing a store.
 *   pnpm --filter @factory/config schema
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { diagramSceneSchema } from '@factory/core';
import { catalogSeedSchema, storeConfigSchema } from './schema.js';

const out = (name: string, schema: z.ZodType) => {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  writeFileSync(join(import.meta.dirname, '..', name), JSON.stringify(json, null, 2) + '\n');
  console.log(`wrote packages/config/${name}`);
};
out('store.schema.json', storeConfigSchema);
out('catalog.schema.json', catalogSeedSchema);
out('diagram.schema.json', diagramSceneSchema);
