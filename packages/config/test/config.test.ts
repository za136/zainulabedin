import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { crossValidate, loadPage, loadStore, PRESETS, renderTemplate, storeConfigSchema } from '../src/index.js';

const dir = fileURLToPath(new URL('../../../stores/wissenswerk', import.meta.url));

describe('store blueprint', () => {
  it('loads the flagship store', () => {
    const s = loadStore(dir);
    expect(s.config.locales.default).toBe('de');
    expect(s.diagrams.size).toBe(3);
  });

  it('cross-validation catches broken references', () => {
    const s = loadStore(dir);
    const broken = structuredClone(s.catalog);
    broken.products[0]!.categories.push('does-not-exist');
    broken.products[1]!.variants[0]!.sku = broken.products[0]!.variants[0]!.sku;
    const problems = crossValidate(s.config, broken, s.diagrams);
    expect(problems.some((p) => p.includes('unknown category'))).toBe(true);
    expect(problems.some((p) => p.includes('duplicate sku'))).toBe(true);
  });

  it('resolves legal pages per locale with German fallback', () => {
    expect(loadPage(dir, 'imprint', 'de')?.markdown).toContain('Impressum');
    expect(loadPage(dir, 'imprint', 'en')?.locale).toBe('en');
    expect(loadPage(dir, 'imprint', 'fr')?.locale).toBe('de');
    expect(loadPage(dir, '../secret', 'de')).toBeUndefined();
  });

  it('renders {{placeholders}}', () => {
    expect(renderTemplate('{{legal.company}} – {{legal.managingDirectors}} – {{legal.missing}}', { legal: { company: 'X GmbH', managingDirectors: ['A', 'B'] } })).toBe('X GmbH – A, B – —');
  });

  it('every preset produces a schema-valid config', () => {
    for (const p of Object.values(PRESETS)) expect(storeConfigSchema.safeParse(p.build({ id: 'x', name: 'X' }).config).success).toBe(true);
  });
});
