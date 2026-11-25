// Content integrity check: `npm run check` (runs in CI).
import { projects, streams } from "./index";

const errors: string[] = [];
const slugs = new Set<string>();
const streamSlugs = new Set(streams.map((s) => s.slug));
for (const p of projects) {
  if (slugs.has(p.slug)) errors.push(`duplicate project slug ${p.slug}`);
  slugs.add(p.slug);
  if (!/^[a-z0-9-]+$/.test(p.slug)) errors.push(`bad slug ${p.slug}`);
  if (!streamSlugs.has(p.stream)) errors.push(`${p.slug}: unknown stream ${p.stream}`);
  if (p.summary.length > 160) errors.push(`${p.slug}: summary longer than 160 chars`);
  for (const l of p.links) if (!l.url.startsWith("https://")) errors.push(`${p.slug}: link must be https`);
}
for (const s of streams) if (!projects.some((p) => p.stream === s.slug)) errors.push(`stream ${s.slug} has no projects`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`content ok: ${streams.length} streams, ${projects.length} projects`);
