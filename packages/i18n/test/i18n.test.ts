import { describe, expect, it } from 'vitest';
import { messages } from '../src/index.js';

const keys = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));

describe('translations', () => {
  it('every locale has exactly the German keys', () => {
    const de = keys(messages.de).sort();
    for (const [locale, m] of Object.entries(messages)) expect(keys(m).sort(), locale).toEqual(de);
  });
  it('no empty strings', () => {
    for (const m of Object.values(messages)) for (const k of keys(m)) expect(k.split('.').reduce((o: any, x) => o[x], m), k).not.toBe('');
  });
});
