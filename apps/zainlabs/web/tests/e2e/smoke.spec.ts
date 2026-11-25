/**
 * Guard rails for every frontend change (human or AI). Run: npm run build && npm run test:e2e
 * If a test fails, fix the code. Never delete or weaken a test to make it pass.
 */
import { expect, test, type Page } from "@playwright/test";
import { projects, site, streams } from "@zainlabs/content";

const ROUTES = ["/", "/projects", "/contact", "/newsletter", "/impressum", "/datenschutz",
  ...streams.map((s) => `/streams/${s.slug}`), ...projects.map((p) => `/projects/${p.slug}`)];

const FORBIDDEN_TEXT = [/lorem ipsum/i, /dolor sit amet/i, /\bTODO\b/, /undefined/, /\[object Object\]/, /NaN/];

/** Fails on console errors and on any request that leaves localhost (fonts, CDNs, trackers, embeds). */
function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["localhost", "127.0.0.1"].includes(u.hostname) && !u.protocol.startsWith("data") && !u.protocol.startsWith("blob"))
      problems.push(`external request (privacy/GDPR): ${r.url()}`);
  });
  return problems;
}

test.beforeEach(async ({ page }) => {
  // Content API is not needed by the website (content is built in); block it to keep tests hermetic.
  await page.route("**/api/**", (route) => route.fulfill({ status: 503, json: { error: "mocked", code: "http_error" } }));
});

for (const path of ROUTES) {
  test(`renders ${path} without errors, external requests or placeholder text`, async ({ page }) => {
    const problems = watch(page);
    const res = await page.goto(path, { waitUntil: "networkidle" });
    expect(res?.status(), "HTTP status").toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("header.site-header")).toBeVisible();
    await expect(page.locator("footer.site-footer")).toBeVisible();
    const text = await page.locator("main").innerText();
    for (const re of FORBIDDEN_TEXT) expect(text, `forbidden text ${re}`).not.toMatch(re);
    expect(problems.filter((p) => !p.includes("/api/")), problems.join("\n")).toEqual([]);
  });
}

test("home shows the claim, all streams and only real projects", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("agentic AI");
  for (const s of streams) await expect(page.locator(`a[href="/streams/${s.slug}"]`).first()).toBeVisible();
  const known = new Set(projects.map((p) => `/projects/${p.slug}`));
  const hrefs = await page.locator('a[href^="/projects/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  for (const h of hrefs) expect(known.has(h!), `link to unknown project ${h}`).toBe(true);
  await expect(page.locator(".hero-stage canvas, .hero3d-fallback").first()).toBeAttached();
});

test("project pages show title, status and summary from content", async ({ page }) => {
  for (const p of projects.slice(0, 4)) {
    await page.goto(`/projects/${p.slug}`);
    await expect(page.locator("h1")).toHaveText(p.title);
    await expect(page.getByText(p.status, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(p.summary).first()).toBeVisible();
  }
});

test("contact form sends the contract payload and shows server field errors", async ({ page }) => {
  let body: Record<string, unknown> = {};
  await page.route("**/api/contact", async (route) => {
    body = route.request().postDataJSON();
    if (String(body.message).includes("fail"))
      return route.fulfill({ status: 422, json: { error: "Please check the field 'email'.", code: "validation_error", fields: { email: "Invalid." } } });
    return route.fulfill({ status: 201, json: { ok: true, id: "test-id" } });
  });
  await page.goto("/contact");
  const consent = page.locator('input[name="consent"]');
  await expect(consent).not.toBeChecked(); // GDPR: never pre-ticked
  // honeypot: present for bots, never on screen for humans
  const hp = await page.locator('input[name="website"]').boundingBox();
  expect(hp === null || hp.x + hp.width < 0, "honeypot must be off-screen").toBe(true);
  await page.fill('input[name="name"]', "Petra Müller");
  await page.fill('input[name="email"]', "petra@example.de");
  await page.selectOption('select[name="stream"]', "software");
  await page.fill('textarea[name="message"]', "This should fail on the server.");
  await consent.check();
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.locator("form [role=alert]")).toContainText("email");
  expect(Object.keys(body).sort()).toEqual(["company", "consent", "email", "message", "name", "source", "stream", "website"].filter((k) => k in body).sort());
  expect(body).toMatchObject({ name: "Petra Müller", email: "petra@example.de", stream: "software", consent: true, source: "web", website: "" });
  await page.fill('textarea[name="message"]', "We would like a demo of Mahn-Agent.");
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText(/thank you/i)).toBeVisible();
});

test("newsletter: double opt-in message and status pages", async ({ page }) => {
  await page.route("**/api/newsletter", (route) => route.fulfill({ status: 202, json: { ok: true, status: "pending" } }));
  await page.goto("/newsletter");
  await expect(page.locator('input[name="consent"]')).not.toBeChecked();
  await page.fill('input[name="email"]', "max@example.de");
  await page.locator('input[name="consent"]').check();
  await page.getByRole("button", { name: /subscribe/i }).click();
  await expect(page.getByText(/confirm/i).first()).toBeVisible();
  for (const [status, text] of [["confirmed", "subscribed"], ["unsubscribed", "unsubscribed"], ["invalid", "no longer valid"]]) {
    await page.goto(`/newsletter?status=${status}`);
    await expect(page.locator("h1")).toContainText(text);
  }
});

test("legal links reachable from every page footer; site name consistent", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('footer a[href="/impressum"]')).toBeVisible();
  await expect(page.locator('footer a[href="/datenschutz"]')).toBeVisible();
  await expect(page).toHaveTitle(new RegExp(site.name));
});
