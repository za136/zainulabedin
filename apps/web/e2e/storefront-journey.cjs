// Storefront smoke test (real browser): home → search → 3D PDP → cart → coupon → checkout → mock pay → account → EN → legal.
// Run API + web, then: node apps/web/e2e/storefront-journey.cjs <screenshot-dir>   (BASE_URL defaults to http://localhost:3000)
const { chromium } = require('playwright');
const SP = process.argv[2] ?? '.';
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const step = async (name, fn) => { try { await fn(); console.log('✓', name); } catch (e) { console.log('✗', name, e.message.split('\n')[0]); await page.screenshot({ path: `${SP}/shots/fail-${name}.png` }); } };

  await step('home', async () => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas', { timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SP}/shots/01-home.png` });
    await page.screenshot({ path: `${SP}/shots/01-home-full.png`, fullPage: true });
  });
  await step('search', async () => {
    await page.fill('#site-search', 'Sprachmodelle');
    await page.press('#site-search', 'Enter');
    await page.waitForURL(/q=Sprachmodelle/);
    await page.waitForSelector('article');
    await page.screenshot({ path: `${SP}/shots/02-search.png` });
  });
  await step('pdp-3d', async () => {
    await page.goto(BASE + '/products/sprachmodelle-verstehen-3d', { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas', { timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SP}/shots/03-pdp-3d.png`, fullPage: true });
  });
  await step('add-book+reader', async () => {
    await page.goto(BASE + '/products/wissenswerk-reader-7', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SP}/shots/04-pdp-reader.png`, fullPage: true });
    await page.getByRole('button', { name: /In den Warenkorb/ }).click();
    await page.getByText('Hinzugefügt!').waitFor();
    await page.goto(BASE + '/products/wie-das-internet-funktioniert-ebook', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /In den Warenkorb/ }).click();
    await page.getByText('Hinzugefügt!').waitFor();
    await page.goto(BASE + '/products/architektur-review', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SP}/shots/05-pdp-service.png`, fullPage: true });
    await page.getByRole('button', { name: /Termin buchen/ }).click();
    await page.getByText('Hinzugefügt!').waitFor();
  });
  await step('cart', async () => {
    await page.goto(BASE + '/cart', { waitUntil: 'networkidle' });
    await page.fill('#coupon', 'WILLKOMMEN10');
    await page.getByRole('button', { name: 'Einlösen' }).click();
    await page.getByText(/Gutschein WILLKOMMEN10 angewendet/).waitFor();
    await page.screenshot({ path: `${SP}/shots/06-cart.png`, fullPage: true });
  });
  await step('checkout', async () => {
    await page.getByRole('link', { name: 'Zur Kasse' }).click();
    await page.waitForURL(/checkout/);
    await page.fill('input[name=email]', 'e2e-' + Date.now() + '@example.com');
    await page.fill('input[name="billing.firstName"]', 'Erika');
    await page.fill('input[name="billing.lastName"]', 'Musterfrau');
    await page.fill('input[name="billing.street"]', 'Hauptstraße 5');
    await page.fill('input[name="billing.zip"]', '80331');
    await page.fill('input[name="billing.city"]', 'München');
    await page.fill('input[name=password]', 'e2e-password-123');
    await page.check('input[name="consent.terms"]');
    await page.check('input[name="consent.digital_waiver"]');
    await page.check('input[name="consent.service_early_start"]');
    await page.screenshot({ path: `${SP}/shots/07-checkout.png`, fullPage: true });
    await page.getByRole('button', { name: 'Zahlungspflichtig bestellen' }).click();
    await page.waitForURL(/mock-pay/, { timeout: 20000 });
    await page.screenshot({ path: `${SP}/shots/08-mockpay.png` });
    await page.getByRole('button', { name: 'Zahlung bestätigen' }).click();
    await page.waitForURL(/success/, { timeout: 20000 });
    await page.getByRole('heading', { name: /Vielen Dank/ }).waitFor();
    await page.screenshot({ path: `${SP}/shots/09-success.png`, fullPage: true });
  });
  await step('account', async () => {
    await page.goto(BASE + '/account', { waitUntil: 'networkidle' });
    await page.getByText('Bibliothek').first().waitFor();
    await page.screenshot({ path: `${SP}/shots/10-account.png`, fullPage: true });
  });
  await step('english', async () => {
    await page.goto(BASE + '/en/products/wie-das-internet-funktioniert', { waitUntil: 'networkidle' });
    await page.getByText('How the Internet Works').first().waitFor();
    await page.screenshot({ path: `${SP}/shots/11-en-pdp.png` });
  });
  await step('legal', async () => {
    await page.goto(BASE + '/legal/impressum', { waitUntil: 'networkidle' });
    await page.getByText('Angaben gemäß § 5 DDG').waitFor();
    await page.screenshot({ path: `${SP}/shots/12-impressum.png` });
  });
  await step('mobile-home', async () => {
    const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await m.goto(BASE + '/', { waitUntil: 'networkidle' });
    await m.waitForTimeout(1500);
    await m.screenshot({ path: `${SP}/shots/13-mobile.png` });
  });
  console.log('errors:', [...new Set(errors)].slice(0, 15));
  await browser.close();
})();
