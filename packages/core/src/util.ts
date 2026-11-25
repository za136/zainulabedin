// Web Crypto works in Node ≥ 19, browsers and edge runtimes — keeps core isomorphic.
export function id(prefix?: string): string {
  const u = globalThis.crypto.randomUUID();
  return prefix ? `${prefix}_${u.replace(/-/g, '')}` : u;
}

const UMLAUTS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'ae', Ö: 'oe', Ü: 'ue', ß: 'ss' };

/** German-aware slug: "Größenwahn & Co." → "groessenwahn-co" */
export function slugify(input: string): string {
  return input
    .replace(/[äöüÄÖÜß]/g, (c) => UMLAUTS[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

/** Human-friendly licence key: `SF-7KQ2-M9XA-P3DR-HN4T` */
export function licenseKey(prefix = 'SF', groups = 4, groupLen = 4): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(groups * groupLen));
  const chars = [...bytes].map((b) => KEY_ALPHABET[b % KEY_ALPHABET.length]);
  const parts: string[] = [];
  for (let g = 0; g < groups; g++) parts.push(chars.slice(g * groupLen, (g + 1) * groupLen).join(''));
  return [prefix, ...parts].join('-');
}
