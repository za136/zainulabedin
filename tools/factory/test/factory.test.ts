import { mkdtempSync, cpSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRESETS } from '@factory/config';
import { createStore, newDiagram, newProduct, validateStore, type Io } from '../src/commands.js';

const repo = new URL('../../..', import.meta.url).pathname;

function sandbox(): Io {
  const root = mkdtempSync(join(tmpdir(), 'factory-'));
  mkdirSync(join(root, 'stores'));
  cpSync(join(repo, 'tools/factory/templates'), join(root, 'tools/factory/templates'), { recursive: true });
  cpSync(join(repo, 'stores/wissenswerk'), join(root, 'stores/wissenswerk'), { recursive: true });
  const logs: string[] = [];
  return { root, log: (m) => logs.push(m) };
}

describe('factory', () => {
  it.each(Object.keys(PRESETS))('creates a valid store from preset %s', (preset) => {
    const io = sandbox();
    createStore(io, { id: `shop-${preset}`, preset, name: `Shop ${preset}` });
    expect(validateStore(io, `shop-${preset}`)).toBe(true);
    expect(existsSync(join(io.root, 'stores', `shop-${preset}`, 'content/de/impressum.md'))).toBe(true);
  });

  it('clones an existing store', () => {
    const io = sandbox();
    createStore(io, { id: 'zweitshop', preset: 'general', from: 'wissenswerk', name: 'Zweitshop' });
    const cfg = JSON.parse(readFileSync(join(io.root, 'stores/zweitshop/store.json'), 'utf8'));
    expect(cfg.id).toBe('zweitshop');
    expect(validateStore(io, 'zweitshop')).toBe(true);
  });

  it('scaffolds products and diagrams that validate', () => {
    const io = sandbox();
    createStore(io, { id: 'books', preset: 'bookstore' });
    newProduct(io, 'books', 'ebook', 'mein-ebook');
    newDiagram(io, 'books', 'kapitel-1');
    expect(validateStore(io, 'books')).toBe(true);
  });

  it('refuses to overwrite', () => {
    const io = sandbox();
    expect(() => createStore(io, { id: 'wissenswerk', preset: 'general' })).toThrow(/exists/);
  });
});
