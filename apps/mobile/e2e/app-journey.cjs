// App smoke test on an emulated iPhone 13 + tablet, against the Expo web build.
// pnpm mobile:export (or: cd apps/mobile && npx expo export --platform web), serve dist/ as an SPA on :8081,
// run API + web, then: node apps/mobile/e2e/app-journey.cjs <screenshot-dir>
const { chromium, devices } = require('playwright');
const SP = process.argv[2] ?? '.';
const BASE = process.env.APP_URL ?? 'http://localhost:8081';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  const shot = (n) => page.screenshot({ path: `${SP}/${n}.png` });
  const step = async (name, fn) => { try { await fn(); console.log('✓', name); } catch (e) { console.log('✗', name, e.message.split('\n')[0]); await shot('fail-' + name); } };
  await step('home', async () => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.getByText('Bücher, die man begreifen kann.').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(800); await shot('01-home');
  });
  await step('catalog-search', async () => {
    await page.getByRole('tab', { name: /Suche/ }).click();
    const input = page.getByLabel('Suchen');
    await input.fill('Reader'); await input.press('Enter');
    await page.getByText('Wissenswerk Reader 7').first().waitFor();
    await shot('02-search');
  });
  await step('product-add', async () => {
    await page.locator('[role=link][aria-label="Wissenswerk Reader 7"]:visible').last().click();
    await page.getByRole('button', { name: 'In den Warenkorb' }).waitFor();
    await shot('03-product');
    await page.locator('[role=button][aria-label="In den Warenkorb"]:visible').last().click();
    await page.getByText('Hinzugefügt!').waitFor();
  });
  await step('cart', async () => {
    await page.goto(BASE + '/cart', { waitUntil: 'networkidle' });
    await page.getByText('Gesamtsumme').waitFor();
    await shot('04-cart');
  });
  await step('checkout', async () => {
    await page.locator('[role=button][aria-label="Zur Kasse"]:visible').last().click();
    await page.getByLabel('E-Mail-Adresse').fill(`app-${Date.now()}@example.com`);
    await page.getByLabel('Vorname', { exact: true }).fill('Erika');
    await page.getByLabel('Nachname', { exact: true }).fill('Musterfrau');
    await page.getByLabel('Straße und Hausnummer').fill('Hauptstraße 5');
    await page.getByLabel('PLZ', { exact: true }).fill('80331');
    await page.getByLabel('Ort', { exact: true }).fill('München');
    await page.getByLabel('Passwort (mind. 10 Zeichen)').fill('app-password-123');
    await page.getByRole('checkbox', { name: /AGB gelesen/ }).click();
    await shot('05-checkout');
    await page.getByRole('button', { name: 'Zahlungspflichtig bestellen' }).click();
    await page.getByText('Testzahlung (Entwicklung)').first().waitFor({ timeout: 20000 }).catch(() => {});
    await page.getByRole('button', { name: 'Zahlung bestätigen' }).waitFor({ timeout: 20000 });
    await shot('06-order-pending');
    await page.getByRole('button', { name: 'Zahlung bestätigen' }).click();
    await page.getByText('Vielen Dank für Ihre Bestellung!').waitFor({ timeout: 20000 });
    await shot('07-order-paid');
  });
  await step('account', async () => {
    await page.goto(BASE + '/account', { waitUntil: 'networkidle' });
    await page.getByText(/Hallo Erika/).waitFor({ timeout: 15000 });
    await shot('08-account');
  });
  await step('english', async () => {
    await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'English' }).click();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.getByText('Books you can actually grasp.').first().waitFor({ timeout: 15000 });
    await shot('09-home-en');
  });
  await step('legal', async () => {
    await page.goto(BASE + '/legal/imprint', { waitUntil: 'networkidle' });
    await page.getByText(/Legal notice|Impressum/).first().waitFor();
    await shot('10-legal');
  });
  await step('tablet', async () => {
    const t = await browser.newPage({ viewport: { width: 1024, height: 1366 } });
    await t.goto(BASE + '/catalog', { waitUntil: 'networkidle' });
    await t.waitForTimeout(1500);
    await t.screenshot({ path: `${SP}/11-tablet.png` });
  });
  console.log('errors:', [...new Set(errors)].slice(0, 10));
  await browser.close();
})();
