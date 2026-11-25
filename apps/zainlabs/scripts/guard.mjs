#!/usr/bin/env node
// Anti-hallucination guard for the ZAIN LABS frontends. No dependencies; run: node apps/zainlabs/scripts/guard.mjs
// Fails (exit 1) on rule violations that tests and the type checker cannot see.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ZL = fileURLToPath(new URL("..", import.meta.url));
const errors = [];
const fail = (msg) => errors.push(msg);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", "dist", ".expo", "test-results"].includes(name)) continue;
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p, out) : /\.(tsx?|css)$/.test(name) && out.push(p);
  }
  return out;
}

// 1. dependencies must be approved
const approved = JSON.parse(readFileSync(join(ZL, "scripts/approved-dependencies.json"), "utf8"));
for (const app of ["web", "mobile", "content"]) {
  const pkg = JSON.parse(readFileSync(join(ZL, app, "package.json"), "utf8"));
  for (const kind of ["dependencies", "devDependencies"]) {
    for (const dep of Object.keys(pkg[kind] ?? {})) {
      if (!approved[app][kind].includes(dep))
        fail(`${app}/package.json: "${dep}" is not approved (ask the owner, then add it to scripts/approved-dependencies.json)`);
    }
  }
}

// 2. forbidden patterns in frontend source
const RULES = [
  [/fetch\(\s*[`'"][^`'"]*\/api\//, "call the backend only through the typed client (@zainlabs/content createApi / web/lib/api.ts)"],
  [/from\s+["']next\/font\/google["']/, "next/font/google sends requests to Google (GDPR): use the system font stack"],
  [/from\s+["']next\/router["']/, "App Router only: use next/navigation"],
  [/getServerSideProps|getStaticProps|getInitialProps/, "Pages Router APIs do not exist in this App Router project"],
  [/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|unpkg\.com|cdnjs|googletagmanager|google-analytics|facebook\.net|hotjar/, "no third-party CDNs, fonts or trackers"],
  [/lorem ipsum|dolor sit amet/i, "no placeholder text"],
  [/@tailwind|className="[^"]*(?:\b(?:p[xytblr]?|m[xytblr]?|gap|w|h)-\d|\b(?:text|bg|border)-(?:xs|sm|lg|xl|\dxl|[a-z]+-\d{2,3})\b|\bflex-(?:col|row|wrap)\b|\bgrid-cols-\d)/,
    "Tailwind is not installed: use the classes in web/app/globals.css"],
];
const webFiles = walk(join(ZL, "web")).filter((f) => !f.includes("/tests/"));
const mobileFiles = walk(join(ZL, "mobile"));
for (const f of [...webFiles, ...mobileFiles]) {
  const text = readFileSync(f, "utf8");
  for (const [re, why] of RULES) if (re.test(text)) fail(`${relative(ZL, f)}: ${why}`);
}

// 3. App Router only
if (existsSync(join(ZL, "web/pages")) || existsSync(join(ZL, "web/src/pages"))) fail("web/pages/ must not exist (App Router project)");
if (existsSync(join(ZL, "web/app/api"))) fail("web/app/api/ must not exist: the backend is apps/zainlabs/api");

// 4. hard-coded project data: project titles must only come from content/
const projects = JSON.parse(readFileSync(join(ZL, "content/content.json"), "utf8")).projects;
for (const f of [...webFiles, ...mobileFiles].filter((f) => /\.tsx?$/.test(f))) {
  const text = readFileSync(f, "utf8");
  for (const p of projects)
    if (p.summary.length > 30 && text.includes(p.summary.slice(0, 30)))
      fail(`${relative(ZL, f)}: hard-coded copy of project "${p.slug}"; read it from @zainlabs/content`);
}

// 5. design tokens: app theme must match website tokens
const css = readFileSync(join(ZL, "web/app/globals.css"), "utf8");
const theme = readFileSync(join(ZL, "mobile/src/theme.ts"), "utf8");
const token = (name) => (css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`)) ?? [])[1]?.toLowerCase();
const themeVal = (name) => (theme.match(new RegExp(`\\b${name}:\\s*"(#[0-9a-fA-F]{6})"`)) ?? [])[1]?.toLowerCase();
for (const [cssName, tsName] of [["ink", "ink"], ["ink-2", "ink2"], ["paper", "paper"], ["paper-2", "paper2"], ["line-light", "line"], ["muted", "muted"], ["muted-on-dark", "mutedOnDark"], ["accent", "accent"], ["accent-on-dark", "accentOnDark"]]) {
  if (!token(cssName) || token(cssName) !== themeVal(tsName))
    fail(`design token mismatch: --${cssName} ${token(cssName)} (web) vs ${tsName} ${themeVal(tsName)} (mobile/src/theme.ts)`);
}

// 6. legal pages must exist
for (const p of ["web/app/impressum/page.tsx", "web/app/datenschutz/page.tsx"]) if (!existsSync(join(ZL, p))) fail(`${p} missing (legally required in Germany)`);

if (errors.length) {
  console.error(`guard: ${errors.length} problem(s)\n- ` + errors.join("\n- "));
  process.exit(1);
}
console.log("guard OK: dependencies approved, no forbidden patterns, tokens in sync, legal pages present");
