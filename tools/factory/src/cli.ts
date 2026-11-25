#!/usr/bin/env tsx
import { parseArgs } from 'node:util';
import { PRESETS } from '@factory/config';
import { appIcon, canvaPull, createStore, defaultIo, listStores, newDiagram, newProduct, validateStore } from './commands.js';

const HELP = `
E-Commerce Store Factory 🏭

Usage: pnpm factory <command> [options]

  create <id> --preset <preset> [--name "Shop Name"] [--company "X GmbH"] [--email a@b.de] [--force]
  create <id> --from <existing-store>      clone an existing store as a starting point
  presets                                  list presets
  list                                     list stores in ./stores
  validate [id|--all]                      validate store.json, catalog, diagrams & cross-references
  product:new <store> <kind> <slug>        scaffold a draft product of a kind
  diagram:new <store> <id>                 scaffold a 3D diagram scene
  canva:pull <store>                       export Canva designs listed in store.json into assets/
  app:icon <store>                         save the iOS/Android app icon rendered from the store theme

Run a store:  STORE=<id> pnpm dev
`;

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      preset: { type: 'string', default: 'general' },
      name: { type: 'string' },
      company: { type: 'string' },
      email: { type: 'string' },
      from: { type: 'string' },
      force: { type: 'boolean', default: false },
      all: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const io = defaultIo();
  const [cmd, a, b, c] = positionals;
  switch (cmd) {
    case 'create':
      if (!a) throw new Error('usage: create <id> --preset <preset>');
      createStore(io, { id: a, preset: values.preset!, name: values.name, company: values.company, email: values.email, from: values.from, force: values.force });
      validateStore(io, a);
      break;
    case 'presets':
      for (const p of Object.values(PRESETS)) io.log(`${p.id.padEnd(12)} ${p.description.de}\n${''.padEnd(12)} kinds: ${p.kinds.join(', ')}`);
      break;
    case 'list':
      for (const s of listStores(io)) io.log(s);
      break;
    case 'validate': {
      const ids = values.all || !a ? listStores(io) : [a];
      const ok = ids.map((id) => validateStore(io, id)).every(Boolean);
      process.exitCode = ok ? 0 : 1;
      break;
    }
    case 'product:new':
      if (!a || !b || !c) throw new Error('usage: product:new <store> <kind> <slug>');
      newProduct(io, a, b, c);
      break;
    case 'diagram:new':
      if (!a || !b) throw new Error('usage: diagram:new <store> <id>');
      newDiagram(io, a, b);
      break;
    case 'app:icon':
      if (!a) throw new Error('usage: app:icon <store>');
      await appIcon(io, a);
      break;
    case 'canva:pull':
      if (!a) throw new Error('usage: canva:pull <store>');
      await canvaPull(io, a);
      break;
    default:
      console.log(HELP);
  }
}

main().catch((e) => {
  console.error(`✖ ${(e as Error).message}`);
  process.exit(1);
});
